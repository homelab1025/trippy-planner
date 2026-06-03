import React, { useMemo } from 'react';
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import type { Climb } from '../utils/climbDetector';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { formatElapsed } from '../hooks/useWeatherChartData';
import ClimbOverlay, { type ClimbTimeRange } from './ClimbOverlay';

interface ElevationChartProps {
  data: ChartDataPoint[];
  totalDistance: number;
  climbs: Climb[];
  avgSpeed: number;
  startTime: Date;
  xAxisMode: 'clock' | 'elapsed';
  onHoverIndex: (index: number | null) => void;
  onResize: (width: number) => void;
}

const ElevationChart: React.FC<ElevationChartProps> = ({
  data, totalDistance, climbs, avgSpeed, startTime, xAxisMode, onHoverIndex, onResize,
}) => {
  const climbTimeRanges = useMemo((): ClimbTimeRange[] => {
    if (!climbs.length || avgSpeed <= 0) return [];
    const startMs = startTime.getTime();
    const speedFactor = avgSpeed * 1000;
    const domainMax = startMs + (totalDistance / speedFactor) * 3_600_000;
    return climbs.map(climb => ({
      ...climb,
      x1: Math.max(startMs, Math.min(startMs + (climb.startDistance / speedFactor) * 3_600_000, domainMax)),
      x2: Math.max(startMs, Math.min(startMs + (climb.endDistance / speedFactor) * 3_600_000, domainMax)),
    }));
  }, [climbs, startTime, avgSpeed, totalDistance]);

  return (
    <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => onResize(w)}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          onMouseMove={(state) => {
            const idx = state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : NaN;
            if (isNaN(idx) || !data[idx]) { onHoverIndex(null); return; }
            onHoverIndex(idx);
          }}
          onMouseLeave={() => onHoverIndex(null)}
        >
          <defs>
            <linearGradient id="colorEle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2d5a27" stopOpacity={0.3} />
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
