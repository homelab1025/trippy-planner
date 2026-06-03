import React, { useMemo } from 'react';
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { RouteData } from '../utils/gpxParser';
import type { Climb } from '../utils/climbDetector';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { formatElapsed } from '../hooks/useWeatherChartData';
import ClimbOverlay from './ClimbOverlay';

export interface ClimbTimeRange extends Climb {
  x1: number;
  x2: number;
}

interface ElevationChartProps {
  route: RouteData;
  climbs?: Climb[];
  avgSpeed: number;
  startTime: Date;
  xAxisMode: 'clock' | 'elapsed';
  data: ChartDataPoint[];
  onHoverDistance: (distanceKm: number | null) => void;
  onResize: (width: number) => void;
}

const ElevationChart: React.FC<ElevationChartProps> = ({
  route, climbs, avgSpeed, startTime, xAxisMode, data, onHoverDistance, onResize,
}) => {
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%" onResize={onResize}>
        <ComposedChart
          data={data}
          syncId="route-charts"
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
              <stop offset="5%"  stopColor="#2d5a27" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2d5a27" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => xAxisMode === 'clock'
              ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : formatElapsed(v - (data[0]?.time ?? v))}
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
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            labelFormatter={(label, payload) => {
              const km = (payload?.[0]?.payload?.distance as number | undefined)?.toFixed(1) ?? '?';
              const timeStr = xAxisMode === 'clock'
                ? new Date(Number(label)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : formatElapsed(Number(label) - (data[0]?.time ?? Number(label)));
              return `${timeStr} · ${km} km`;
            }}
            formatter={(value) => [`${Math.round(Number(value))}m`, 'Elevation']}
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
          <ClimbOverlay climbTimeRanges={climbTimeRanges} data={data} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(ElevationChart);
