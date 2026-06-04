import React from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatElapsed } from '../hooks/useWeatherChartData';

export interface WeatherLinePoint {
  time: number;
  distance: number;
  line1: number | undefined;
  line2: number | undefined;
}

export interface WeatherLineConfig {
  label: string;
  color: string;
  format: (v: number) => string;
  yAxisId: string;
  domain?: [number, number];
}

interface WeatherLineChartProps {
  data: WeatherLinePoint[];
  line1Config: WeatherLineConfig;
  line2Config: WeatherLineConfig;
  xAxisMode: 'clock' | 'elapsed';
  onHoverIndex: (index: number | null) => void;
  weatherAvailable: boolean | null;
}

const WeatherLineChart: React.FC<WeatherLineChartProps> = React.memo(({
  data, line1Config, line2Config, xAxisMode, onHoverIndex, weatherAvailable,
}) => (
  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
    <ResponsiveContainer width="100%" height="100%">
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
          yAxisId={line1Config.yAxisId}
          domain={line1Config.domain}
          axisLine={false}
          tickLine={false}
          fontSize={10}
          stroke="#888"
          tickFormatter={(v) => line1Config.format(v)}
        />
        <YAxis
          yAxisId={line2Config.yAxisId}
          orientation="right"
          domain={line2Config.domain}
          axisLine={false}
          tickLine={false}
          fontSize={10}
          stroke="#888"
          tickFormatter={(v) => line2Config.format(v)}
        />
        <Tooltip
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
          formatter={(value, name) => {
            if (name === line1Config.label) return [line1Config.format(Number(value)), name];
            if (name === line2Config.label) return [line2Config.format(Number(value)), name];
            return [value, name];
          }}
        />
        <Line
          yAxisId={line1Config.yAxisId}
          type="monotone"
          dataKey="line1"
          stroke={line1Config.color}
          dot={false}
          name={line1Config.label}
          isAnimationActive={false}
        />
        <Line
          yAxisId={line2Config.yAxisId}
          type="monotone"
          dataKey="line2"
          stroke={line2Config.color}
          dot={false}
          name={line2Config.label}
          isAnimationActive={false}
        />
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
