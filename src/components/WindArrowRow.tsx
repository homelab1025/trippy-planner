import React from 'react';
import { Wind } from 'lucide-react';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

interface WindArrowRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  chartWidth: number;
  hoveredDistance: number | null;
}

const PLOT_LEFT = 55;
const PLOT_RIGHT_OFFSET = 55;

const WindArrowRow: React.FC<WindArrowRowProps> = ({ samplePoints, distanceRange, chartWidth, hoveredDistance }) => {
  if (!samplePoints.length || chartWidth < 1) return null;

  const [dMin, dMax] = distanceRange;
  const plotWidth = chartWidth - PLOT_LEFT - PLOT_RIGHT_OFFSET;
  const xOf = (d: number) => PLOT_LEFT + ((d - dMin) / (dMax - dMin)) * plotWidth;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
        color: '#94a3b8', pointerEvents: 'none',
      }}>
        <Wind size={14} />
      </div>
      <svg width={chartWidth} height={40}>
        {/* Dashed baseline */}
        <line
          x1={PLOT_LEFT} y1={22}
          x2={chartWidth - PLOT_RIGHT_OFFSET} y2={22}
          stroke="#bfdbfe" strokeWidth={1.5} strokeDasharray="4 4"
        />
        {samplePoints.map((pt, i) => {
          if (pt.windSpeed == null || pt.windDeg == null) return null;
          const x = xOf(pt.distance);
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
          return (
            <text
              key={i}
              x={xOf(pt.distance)} y={37}
              textAnchor="middle" fontSize={9}
              fill="#3b82f6" fontWeight="600"
            >
              {Math.round(pt.windSpeed)}
            </text>
          );
        })}
        {hoveredDistance !== null && (
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

export default WindArrowRow;
