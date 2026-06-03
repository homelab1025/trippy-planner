// src/hooks/useWeatherChartData.ts
import { useMemo } from 'react';
import type { RouteData, RoutePoint } from '../utils/gpxParser';
import type { WeatherData } from '../services/weatherProviders/types';
import { lttbWithPinnedPoints } from '../utils/lttb';

export interface ChartDataPoint {
  distance: number;        // km
  elevation: number;       // metres, rounded
  temp: number | undefined;
  precipProb: number | undefined;
  precipitation: number | undefined;
  windSpeed: number | undefined;
  time: number;            // ms timestamp
  isSample: boolean;
}

export type WeatherPoint = WeatherData & {
  point: RoutePoint;
  arrivalTime: Date;
  label: string;
};

export interface BuildChartDataArgs {
  route: RouteData | null;
  weatherPoints: WeatherPoint[];
  chartWidth: number;
  avgSpeed: number;
  startTime: Date;
}

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
}: BuildChartDataArgs): ChartDataPoint[] {
  if (!route) return [];

  const d: ChartDataPoint[] = route.points.map(pt => ({
    distance: pt.distance / 1000,
    elevation: Math.round(pt.ele),
    temp: undefined,
    precipProb: undefined,
    precipitation: undefined,
    windSpeed: undefined,
    time: startTime.getTime() + (pt.distance / (avgSpeed * 1000)) * 3_600_000,
    isSample: false,
  }));

  weatherPoints.forEach(wp => {
    const rIdx = route.points.indexOf(wp.point);
    if (rIdx >= 0) {
      d[rIdx].temp = wp.temp;
      d[rIdx].precipProb = wp.precipProb;
      d[rIdx].precipitation = wp.precipitation;
      d[rIdx].windSpeed = wp.windSpeed;
      d[rIdx].time = wp.arrivalTime.getTime();
      d[rIdx].isSample = true;
    }
  });

  const downsampled = lttbWithPinnedPoints(
    d,
    Math.max(chartWidth || 800, weatherPoints.length),
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
    const tLo = downsampled[lo].temp,          tHi = downsampled[hi].temp;
    const ppLo = downsampled[lo].precipProb,   ppHi = downsampled[hi].precipProb;
    const pLo = downsampled[lo].precipitation, pHi = downsampled[hi].precipitation;
    const wLo = downsampled[lo].windSpeed,     wHi = downsampled[hi].windSpeed;
    const timeLo = downsampled[lo].time,       timeHi = downsampled[hi].time;
    for (let j = lo + 1; j < hi; j++) {
      const t = (j - lo) / (hi - lo);
      if (tLo != null && tHi != null)    downsampled[j].temp          = tLo  + (tHi  - tLo)  * t;
      if (ppLo != null && ppHi != null)  downsampled[j].precipProb    = ppLo + (ppHi - ppLo) * t;
      if (pLo != null && pHi != null)    downsampled[j].precipitation = pLo  + (pHi  - pLo)  * t;
      if (wLo != null && wHi != null)    downsampled[j].windSpeed     = wLo  + (wHi  - wLo)  * t;
      downsampled[j].time = timeLo + (timeHi - timeLo) * t;
    }
  }

  return downsampled;
}

export function useWeatherChartData(args: BuildChartDataArgs): ChartDataPoint[] {
  const { route, weatherPoints, chartWidth, avgSpeed, startTime } = args;
  return useMemo(
    () => buildChartData({ route, weatherPoints, chartWidth, avgSpeed, startTime }),
    [route, weatherPoints, chartWidth, avgSpeed, startTime],
  );
}
