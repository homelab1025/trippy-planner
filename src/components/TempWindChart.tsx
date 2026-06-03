import React from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { formatElapsed } from '../hooks/useWeatherChartData';

interface TempWindChartProps {
  data: ChartDataPoint[];
  xAxisMode: 'clock' | 'elapsed';
  onHoverIndex: (index: number | null) => void;
  weatherAvailable: boolean | null;
}

const TempWindChart: React.FC<TempWindChartProps> = ({
  data, xAxisMode, onHoverIndex, weatherAvailable,
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
          yAxisId="temp"
          axisLine={false}
          tickLine={false}
          fontSize={10}
          stroke="#888"
          tickFormatter={(v) => `${Math.round(v)}°C`}
        />
        <YAxis
          yAxisId="wind"
          orientation="right"
          axisLine={false}
          tickLine={false}
          fontSize={10}
          stroke="#888"
          tickFormatter={(v) => `${Math.round(v)} km/h`}
        />
        <Tooltip
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
          formatter={(value, name) => {
            if (name === 'Temp') return [`${Math.round(Number(value))}°C`, name];
            if (name === 'Wind') return [`${Math.round(Number(value))} km/h`, name];
            return [value, name];
          }}
        />
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="temp"
          stroke="#ff7300"
          dot={false}
          name="Temp"
          isAnimationActive={false}
        />
        <Line
          yAxisId="wind"
          type="monotone"
          dataKey="windSpeed"
          stroke="#4A9FD9"
          dot={false}
          name="Wind"
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
);

export default React.memo(TempWindChart);
