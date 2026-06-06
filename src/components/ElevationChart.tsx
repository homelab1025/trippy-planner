import React, { useMemo } from 'react';
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceDot, ResponsiveContainer,
} from 'recharts';
import type { Climb } from '../utils/climbDetector';
import ClimbOverlay, { type ClimbRange } from './ClimbOverlay';

export interface ElevationPoint {
  distance: number;
  elevation: number;
}

interface ElevationChartProps {
  data: ElevationPoint[];
  climbs: Climb[];
  onHoverIndex: (index: number | null) => void;
  onResize: (width: number) => void;
  hoveredIndex: number | null;
}

const ElevationChart: React.FC<ElevationChartProps> = ({
  data, climbs, onHoverIndex, onResize, hoveredIndex,
}) => {
  const climbRanges = useMemo((): ClimbRange[] =>
    climbs.map(climb => ({
      ...climb,
      x1: climb.startDistance / 1000,
      x2: climb.endDistance / 1000,
    })),
    [climbs]
  );

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
            dataKey="distance"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => `${Math.round(v)} km`}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="#888"
          />
          <YAxis
            yAxisId="elevation"
            width={45}
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
            activeDot={false}
            isAnimationActive={false}
          />
          <ClimbOverlay climbRanges={climbRanges} data={data} />
          {hoveredIndex !== null && data[hoveredIndex] != null && (
            <>
              <ReferenceLine
                x={data[hoveredIndex].distance}
                yAxisId="elevation"
                stroke="#aaa"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <ReferenceDot
                x={data[hoveredIndex].distance}
                y={data[hoveredIndex].elevation}
                yAxisId="elevation"
                r={4}
                fill="#2d5a27"
                stroke="white"
                strokeWidth={2}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(ElevationChart);
