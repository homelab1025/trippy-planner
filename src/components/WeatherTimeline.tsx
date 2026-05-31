import React, { useMemo, useState } from 'react';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Customized } from 'recharts';
import type { RouteData } from '../utils/gpxParser';
import { lttbWithPinnedPoints } from '../utils/lttb';
import type { Climb } from '../utils/climbDetector';
import ClimbOverlay from './ClimbOverlay';

interface WeatherTimelineProps {
  route: RouteData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weatherPoints: any[];
  onHoverDistance: (distanceKm: number | null) => void;
  xAxisMode: 'clock' | 'elapsed';
  weatherAvailable?: boolean | null;
  avgSpeed: number;
  startTime: Date;
  climbs?: Climb[];
}

export interface ClimbTimeRange extends Climb {
  x1: number;
  x2: number;
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

const WeatherTimeline: React.FC<WeatherTimelineProps> = ({ route, weatherPoints, onHoverDistance, xAxisMode, weatherAvailable, avgSpeed, startTime, climbs }) => {
  const [chartWidth, setChartWidth] = useState(800);
  const [hoveredClimbIdx, setHoveredClimbIdx] = useState<number | null>(null);

  const climbTimeRanges = useMemo((): ClimbTimeRange[] => {
    if (!climbs || climbs.length === 0 || avgSpeed <= 0) return [];
    const startMs = startTime.getTime();
    const speedFactor = avgSpeed * 1000;
    const domainMax = startMs + (route.totalDistance / speedFactor) * 3_600_000;
    return climbs.map(climb => ({
      ...climb,
      x1: Math.max(startMs, Math.min(startMs + (climb.startDistance / speedFactor) * 3_600_000, domainMax)),
      x2: Math.max(startMs, Math.min(startMs + (climb.endDistance / speedFactor) * 3_600_000, domainMax)),
    }));
  }, [climbs, startTime, avgSpeed, route.totalDistance]);

  const data = useMemo(() => {
    const d = route.points.map(pt => ({
      distance: pt.distance / 1000,
      elevation: Math.round(pt.ele),
      temp: undefined as number | undefined,
      precipProb: undefined as number | undefined,
      precipitation: undefined as number | undefined,
      time: startTime.getTime() + (pt.distance / (avgSpeed * 1000)) * 3_600_000,
      isSample: false,
      weatherIdx: undefined as number | undefined,
    }));

    weatherPoints.forEach((wp, wIdx) => {
      const rIdx = route.points.indexOf(wp.point);
      if (rIdx >= 0) {
        d[rIdx].temp = wp.temp;
        d[rIdx].precipProb = wp.precipProb;
        d[rIdx].precipitation = wp.precipitation;
        d[rIdx].time = wp.arrivalTime.getTime();
        d[rIdx].isSample = true;
        d[rIdx].weatherIdx = wIdx;
      }
    });

    const downsampled = lttbWithPinnedPoints(
      d,
      Math.max(chartWidth, weatherPoints.length),
      p => p.isSample,
      p => p.distance,
      p => p.elevation
    );

    // Linearly interpolate temp and time between sample points so the line is continuous
    const sampleIdxs = downsampled
      .map((p, i) => (p.isSample ? i : -1))
      .filter(i => i >= 0)
      .sort((a, b) => a - b);
    for (let i = 0; i < sampleIdxs.length - 1; i++) {
      const lo = sampleIdxs[i], hi = sampleIdxs[i + 1];
      const tLo = downsampled[lo].temp, tHi = downsampled[hi].temp;
      const ppLo = downsampled[lo].precipProb, ppHi = downsampled[hi].precipProb;
      const pLo = downsampled[lo].precipitation, pHi = downsampled[hi].precipitation;
      const timeLo = downsampled[lo].time, timeHi = downsampled[hi].time;
      if (tLo == null || tHi == null || ppLo == null || ppHi == null ||
          pLo == null || pHi == null || timeLo == null || timeHi == null) continue;
      for (let j = lo + 1; j < hi; j++) {
        const t = (j - lo) / (hi - lo);
        downsampled[j].temp = tLo + (tHi - tLo) * t;
        downsampled[j].precipProb = ppLo + (ppHi - ppLo) * t;
        downsampled[j].precipitation = pLo + (pHi - pLo) * t;
        downsampled[j].time = timeLo + (timeHi - timeLo) * t;
      }
    }

    return downsampled;
  }, [route, weatherPoints, chartWidth, avgSpeed, startTime]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => setChartWidth(w)}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          onMouseMove={(state) => {
            const rIdx = state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : NaN;
            if (isNaN(rIdx) || !data[rIdx]) { onHoverDistance(null); return; }
            onHoverDistance(data[rIdx].distance);
          }}
          onMouseLeave={() => onHoverDistance(null)}
        >
          <defs>
            <linearGradient id="colorEle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2d5a27" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#2d5a27" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => xAxisMode === 'clock'
              ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : formatElapsed(v - (data[0]?.time ?? v))
            }
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="#888"
          />
          <YAxis
            yAxisId="elevation"
            domain={[(dataMin: number) => dataMin - 10, 'auto']}
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#888"
            tickFormatter={(v) => `${Math.round(v)}m`}
          />
          <YAxis
            yAxisId="temp"
            orientation="right"
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#888"
            tickFormatter={(v) => `${Math.round(v)}°C`}
          />
          <YAxis
            yAxisId="precip"
            domain={[0, 100]}
            hide={true}
          />
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            labelFormatter={(label, payload) => {
              const km = (payload?.[0]?.payload?.distance as number | undefined)?.toFixed(1) ?? '?';
              const timeStr = xAxisMode === 'clock'
                ? new Date(Number(label)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : formatElapsed(Number(label) - (data[0]?.time ?? Number(label)));
              return `${timeStr} · ${km} km`;
            }}
            formatter={(value, name) => {
              if (name === 'Temp') return [`${Math.round(Number(value))}°C`, name];
              if (name === 'Precip Prob') return [`${Math.round(Number(value))}%`, name];
              if (name === 'Precip') return [`${Number(value).toFixed(1)} mm`, name];
              return [value, name];
            }}
          />
          <Area
            yAxisId="elevation"
            type="monotone"
            dataKey="elevation"
            stroke="#2d5a27"
            fillOpacity={1}
            fill="url(#colorEle)"
            name="Elevation"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temp"
            stroke="#ff7300"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => {
              if (!props.payload.isSample) return <g key={props.index} />;
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="#ff7300" stroke="white" strokeWidth={1.5} />;
            }}
            name="Temp"
            isAnimationActive={false}
          />
          <Line
            yAxisId="precip"
            type="monotone"
            dataKey="precipProb"
            stroke="#4A90D9"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => {
              if (!props.payload.isSample) return <g key={props.index} />;
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="#4A90D9" stroke="white" strokeWidth={1.5} />;
            }}
            name="Precip Prob"
            isAnimationActive={false}
          />
          <Line
            yAxisId="precip"
            type="monotone"
            dataKey="precipitation"
            stroke="none"
            strokeWidth={0}
            activeDot={false}
            dot={false}
            legendType="none"
            name="Precip"
            isAnimationActive={false}
          />
          <Customized
            component={ClimbOverlay}
            climbTimeRanges={climbTimeRanges}
            hoveredClimbIdx={hoveredClimbIdx}
            onHoverClimb={setHoveredClimbIdx}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {weatherAvailable === false && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ color: '#888', fontSize: '0.875rem', fontWeight: 500 }}>
            Weather data unavailable for the selected date
          </span>
        </div>
      )}
    </div>
  );
};

// memo prevents re-renders when App re-renders due to hoveredPoint changes
export default React.memo(WeatherTimeline);
