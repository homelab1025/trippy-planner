import { useMemo } from 'react';
import type { RouteData, RoutePoint } from '../utils/gpxParser';
import type { WeatherData } from '../services/weatherProviders';
import { lttbWithPinnedPoints } from '../utils/lttb';

export interface ChartDataPoint {
  distance: number;       // km
  elevation: number;      // m, rounded
  temp: number | undefined;
  precipProb: number | undefined;
  precipitation: number | undefined;
  windSpeed: number | undefined;
  windDeg: number | undefined;
  time: number;           // ms timestamp
  isSample: boolean;
}

export type WeatherSample = WeatherData & { point: RoutePoint; arrivalTime: Date; label: string };

export function formatElapsed(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function buildChartData({
  route,
  weatherPoints,
  chartWidth,
  avgSpeed,
  startTime,
}: {
  route: RouteData;
  weatherPoints: WeatherSample[];
  chartWidth: number;
  avgSpeed: number;
  startTime: Date;
}): ChartDataPoint[] {
  if (!route.points.length) return [];

  const d: ChartDataPoint[] = route.points.map(pt => ({
    distance: pt.distance / 1000,
    elevation: Math.round(pt.ele),
    temp: undefined,
    precipProb: undefined,
    precipitation: undefined,
    windSpeed: undefined,
    windDeg: undefined,
    time: startTime.getTime() + (pt.distance / (avgSpeed * 1000)) * 3_600_000,
    isSample: false,
  }));

  weatherPoints.forEach(wp => {
    const rIdx = route.points.indexOf(wp.point);
    if (rIdx < 0) return;
    d[rIdx].temp = wp.temp;
    d[rIdx].precipProb = wp.precipProb;
    d[rIdx].precipitation = wp.precipitation;
    d[rIdx].windSpeed = wp.windSpeed;
    d[rIdx].windDeg = wp.windDeg;
    d[rIdx].time = wp.arrivalTime.getTime();
    d[rIdx].isSample = true;
  });

  const downsampled = lttbWithPinnedPoints(
    d,
    Math.max(chartWidth, weatherPoints.length),
    p => p.isSample,
    p => p.distance,
    p => p.elevation,
  );

  const sampleIdxs = downsampled
    .map((p, i) => (p.isSample ? i : -1))
    .filter(i => i >= 0)
    .sort((a, b) => a - b);

  for (let i = 0; i < sampleIdxs.length - 1; i++) {
    const lo = sampleIdxs[i], hi = sampleIdxs[i + 1];
    const tLo = downsampled[lo].temp,    tHi = downsampled[hi].temp;
    const ppLo = downsampled[lo].precipProb, ppHi = downsampled[hi].precipProb;
    const pLo = downsampled[lo].precipitation, pHi = downsampled[hi].precipitation;
    const wsLo = downsampled[lo].windSpeed,  wsHi = downsampled[hi].windSpeed;
    const wdLo = downsampled[lo].windDeg,    wdHi = downsampled[hi].windDeg;
    const timeLo = downsampled[lo].time,    timeHi = downsampled[hi].time;
    if (
      tLo === undefined || tHi === undefined || ppLo === undefined || ppHi === undefined ||
      pLo === undefined || pHi === undefined || wsLo === undefined || wsHi === undefined ||
      wdLo === undefined || wdHi === undefined
    ) continue;
    const uLo = -wsLo * Math.sin(wdLo * Math.PI / 180);
    const vLo = -wsLo * Math.cos(wdLo * Math.PI / 180);
    const uHi = -wsHi * Math.sin(wdHi * Math.PI / 180);
    const vHi = -wsHi * Math.cos(wdHi * Math.PI / 180);
    for (let j = lo + 1; j < hi; j++) {
      const t = timeHi !== timeLo
        ? (downsampled[j].time - timeLo) / (timeHi - timeLo)
        : (j - lo) / (hi - lo);
      downsampled[j].temp          = tLo  + (tHi  - tLo)  * t;
      downsampled[j].precipProb    = ppLo + (ppHi - ppLo) * t;
      downsampled[j].precipitation = pLo  + (pHi  - pLo)  * t;
      const u = uLo + (uHi - uLo) * t;
      const v = vLo + (vHi - vLo) * t;
      downsampled[j].windSpeed     = Math.sqrt(u * u + v * v);
      downsampled[j].windDeg       = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
      downsampled[j].time          = timeLo + (timeHi - timeLo) * t;
    }
  }

  return downsampled;
}

export function useWeatherChartData({
  route,
  weatherPoints,
  chartWidth,
  avgSpeed,
  startTime,
}: {
  route: RouteData | null;
  weatherPoints: WeatherSample[];
  chartWidth: number;
  avgSpeed: number;
  startTime: Date;
}): ChartDataPoint[] {
  return useMemo(
    () => route ? buildChartData({ route, weatherPoints, chartWidth, avgSpeed, startTime }) : [],
    [route, weatherPoints, chartWidth, avgSpeed, startTime],
  );
}
