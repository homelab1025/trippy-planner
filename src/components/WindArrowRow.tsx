import React from 'react';
import { Wind } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, ReferenceLine, useXAxisScale,
} from 'recharts';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { CHART_MARGIN_LEFT, CHART_YAXIS_LEFT_WIDTH } from './ElevationChart';

interface WindArrowRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  hoveredDistance?: number | null;
}

interface WindArrowsLayerProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
}

const WindArrowsLayer: React.FC<WindArrowsLayerProps> = ({ samplePoints, distanceRange }) => {
  const xScale = useXAxisScale();
  if (!xScale) return null;
  const [dMin, dMax] = distanceRange;
  const x1 = xScale(dMin);
  const x2 = xScale(dMax);
  return (
    <>
      <line
        x1={x1} y1={22}
        x2={x2} y2={22}
        stroke="#bfdbfe" strokeWidth={1.5} strokeDasharray="4 4"
      />
      {samplePoints.map((pt, i) => {
        if (pt.windSpeed == null || pt.windDeg == null) return null;
        const x = xScale(pt.distance);
        if (x == null) return null;
        return (
          <g key={i} data-arrow="true" transform={`rotate(${pt.windDeg}, ${x}, 15)`}>
            <line x1={x} y1={22} x2={x} y2={8} stroke="#3b82f6" strokeWidth={2} />
            <polyline
              points={`${x - 4},13 ${x},8 ${x + 4},13`}
              fill="none" stroke="#3b82f6" strokeWidth={2}
            />
          </g>
        );
      })}
      {samplePoints.map((pt, i) => {
        if (pt.windSpeed == null) return null;
        const x = xScale(pt.distance);
        if (x == null) return null;
        return (
          <text
            key={i}
            x={x} y={37}
            textAnchor="middle" fontSize={9}
            fill="#3b82f6" fontWeight="600"
          >
            {Math.round(pt.windSpeed)}
          </text>
        );
      })}
    </>
  );
};

const WindArrowRow: React.FC<WindArrowRowProps> = ({ samplePoints, distanceRange, hoveredDistance }) => {
  if (!samplePoints.length) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
        color: '#94a3b8', pointerEvents: 'none',
      }}>
        <Wind size={14} />
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 0, right: 55, left: CHART_MARGIN_LEFT, bottom: 0 }}>
          <XAxis hide type="number" domain={distanceRange} />
          <YAxis hide width={CHART_YAXIS_LEFT_WIDTH} />
          <WindArrowsLayer samplePoints={samplePoints} distanceRange={distanceRange} />
          {hoveredDistance != null && (
            <ReferenceLine x={hoveredDistance} stroke="#aaa" strokeDasharray="3 3" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WindArrowRow;
