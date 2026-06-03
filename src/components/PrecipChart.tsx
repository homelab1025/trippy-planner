import React from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { formatElapsed } from '../hooks/useWeatherChartData';

interface PrecipChartProps {
  data: ChartDataPoint[];
  xAxisMode: 'clock' | 'elapsed';
  onHoverDistance: (distanceKm: number | null) => void;
  weatherAvailable?: boolean | null;
}

const PrecipChart: React.FC<PrecipChartProps> = ({ data, xAxisMode, onHoverDistance, weatherAvailable }) => (
  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
    <ResponsiveContainer width="100%" height="100%">
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
          yAxisId="precipProb"
          domain={[0, 100]}
          axisLine={false}
          tickLine={false}
          fontSize={10}
          stroke="#888"
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          yAxisId="precipitation"
          orientation="right"
          axisLine={false}
          tickLine={false}
          fontSize={10}
          stroke="#888"
          tickFormatter={(v) => `${v}mm`}
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
            if (name === 'Precip Prob') return [`${Math.round(Number(value))}%`, name];
            if (name === 'Precip')      return [`${Number(value).toFixed(1)} mm`, name];
            return [value, name];
          }}
        />
        <Line
          yAxisId="precipProb"
          type="monotone"
          dataKey="precipProb"
          stroke="#4A90D9"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dot={(props: any) => {
            if (!props.payload.isSample) return null;
            return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="#4A90D9" stroke="white" strokeWidth={1.5} />;
          }}
          name="Precip Prob"
          isAnimationActive={false}
        />
        <Line
          yAxisId="precipitation"
          type="monotone"
          dataKey="precipitation"
          stroke="#1a6bb5"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dot={(props: any) => {
            if (!props.payload.isSample) return null;
            return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="#1a6bb5" stroke="white" strokeWidth={1.5} />;
          }}
          name="Precip"
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

export default React.memo(PrecipChart);
