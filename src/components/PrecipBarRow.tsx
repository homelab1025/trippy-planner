import React from 'react';
import { CloudRain } from 'lucide-react';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { CHART_MARGIN_LEFT, CHART_YAXIS_LEFT_WIDTH } from './chartConstants';

interface PrecipBarRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  chartWidth: number;
  hoveredDistance?: number | null;
}

const PLOT_LEFT = CHART_MARGIN_LEFT + CHART_YAXIS_LEFT_WIDTH;
const PLOT_RIGHT_OFFSET = 55;
const MAX_BAR_HEIGHT = 28;
const BAR_BOTTOM_Y = 36;
const BAR_GAP = 2;

const PrecipBarRow: React.FC<PrecipBarRowProps> = ({ samplePoints, distanceRange, chartWidth, hoveredDistance }) => {
  if (!samplePoints.length || chartWidth < 1) return null;

  const [dMin, dMax] = distanceRange;
  const plotWidth = chartWidth - PLOT_LEFT - PLOT_RIGHT_OFFSET;
  const xOf = (d: number) => PLOT_LEFT + ((d - dMin) / (dMax - dMin)) * plotWidth;

  const maxPrecip = Math.max(...samplePoints.map(p => p.precipitation ?? 0), 1);
  const edges = [dMin, ...samplePoints.map(p => p.distance), dMax];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
        color: '#94a3b8', pointerEvents: 'none',
      }}>
        <CloudRain size={14} />
      </div>
      <svg width={chartWidth} height={40}>
        {edges.slice(0, -1).map((startDist, i) => {
          const endDist = edges[i + 1];
          const sample = samplePoints[Math.max(0, i - 1)];
          const precip = sample.precipitation ?? 0;
          const prob = sample.precipProb ?? 0;
          const barHeight = Math.max((precip / maxPrecip) * MAX_BAR_HEIGHT, 2);
          const opacity = Math.max(prob / 100, 0.05);
          const x1 = xOf(startDist);
          const barWidth = Math.max(xOf(endDist) - x1 - BAR_GAP, 1);
          return (
            <rect
              key={i}
              x={x1}
              y={BAR_BOTTOM_Y - barHeight}
              width={barWidth}
              height={barHeight}
              fill="#3b82f6"
              opacity={opacity}
              rx={2}
            />
          );
        })}
        {hoveredDistance !== null && hoveredDistance !== undefined && (
          <line
            x1={xOf(hoveredDistance)} y1={0}
            x2={xOf(hoveredDistance)} y2={40}
            stroke="#aaa" strokeWidth={1} strokeDasharray="3 3"
          />
        )}
      </svg>
    </div>
  );
};

export { PrecipBarRow };
