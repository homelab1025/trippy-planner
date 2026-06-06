import React from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer,
} from 'recharts';

export interface WeatherLinePoint {
  time: number;
  distance: number;
  line1: number | undefined;
  line2?: number | undefined;
}

export interface WeatherLineConfig {
  label: string;
  color: string;
  format: (v: number) => string;
  yAxisId: string;
  domain?: [number, number];
}

// TODO: refactor line1Config/line2Config into a single array of line configs
interface WeatherLineChartProps {
  data: WeatherLinePoint[];
  line1Config: WeatherLineConfig;
  line2Config?: WeatherLineConfig;
  hoveredIndex: number | null;
  onHoverIndex: (index: number | null) => void;
  weatherAvailable: boolean | null;
  hideAxes?: boolean;
}

const WeatherLineChart: React.FC<WeatherLineChartProps> = React.memo(({
  data, line1Config, line2Config, hoveredIndex, onHoverIndex, weatherAvailable, hideAxes = false,
}) => (
  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={hideAxes ? { top: 4, right: 10, left: 10, bottom: 0 } : { top: 10, right: 10, left: 10, bottom: 0 }}
        onMouseMove={(state) => {
          const idx = state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : NaN;
          if (isNaN(idx) || !data[idx]) { onHoverIndex(null); return; }
          onHoverIndex(idx);
        }}
        onMouseLeave={() => onHoverIndex(null)}
      >
        {!hideAxes && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />}
        <XAxis
          dataKey="distance"
          type="number"
          domain={['dataMin', 'dataMax']}
          height={hideAxes ? 0 : undefined}
          tick={hideAxes ? false : undefined}
          tickFormatter={(v) => `${Math.round(v)} km`}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          stroke="#888"
        />
        <YAxis
          yAxisId={line1Config.yAxisId}
          width={hideAxes ? 45 : undefined}
          domain={line1Config.domain}
          tick={hideAxes ? false : undefined}
          axisLine={false}
          tickLine={false}
          fontSize={10}
          stroke="#888"
          tickFormatter={(v) => line1Config.format(v)}
        />
        {line2Config && (
          <YAxis
            yAxisId={line2Config.yAxisId}
            orientation="right"
            width={hideAxes ? 0 : undefined}
            domain={line2Config.domain}
            tick={hideAxes ? false : undefined}
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#888"
            tickFormatter={(v) => line2Config.format(v)}
          />
        )}
        {hoveredIndex !== null && data[hoveredIndex] != null && (
          <ReferenceLine
            x={data[hoveredIndex].distance}
            yAxisId={line1Config.yAxisId}
            stroke="#aaa"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        <Line
          yAxisId={line1Config.yAxisId}
          type="monotone"
          dataKey="line1"
          stroke={line1Config.color}
          dot={false}
          name={line1Config.label}
          isAnimationActive={false}
        />
        {line2Config && (
          <Line
            yAxisId={line2Config.yAxisId}
            type="monotone"
            dataKey="line2"
            stroke={line2Config.color}
            dot={false}
            name={line2Config.label}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
    {weatherAvailable === false && (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#888', fontSize: '0.875rem', fontWeight: 500 }}>
          Weather data unavailable for the selected date
        </span>
      </div>
    )}
  </div>
));

export default WeatherLineChart;
