import React, { useState } from 'react';
import { useXAxisScale, useYAxisScale, usePlotArea } from 'recharts';
import type { ClimbTimeRange } from './WeatherTimeline';
import type { Climb } from '../utils/climbDetector';

const CATEGORY_COLORS: Record<Climb['category'], string> = {
  Cat4: '#F5C518',
  Cat3: '#F5A623',
  Cat2: '#E8601C',
  Cat1: '#D0021B',
  HC:   '#7B0099',
};

const CATEGORY_FILL_OPACITY: Record<Climb['category'], number> = {
  Cat4: 0.30,
  Cat3: 0.40,
  Cat2: 0.50,
  Cat1: 0.60,
  HC:   0.70,
};

interface ElevDataPoint {
  time: number;
  elevation: number;
}

interface ClimbOverlayProps {
  climbTimeRanges: ClimbTimeRange[];
  data: ElevDataPoint[];
}

const ClimbOverlay: React.FC<ClimbOverlayProps> = ({ climbTimeRanges, data }) => {
  const [hoveredClimbIdx, setHoveredClimbIdx] = useState<number | null>(null);
  void hoveredClimbIdx; void setHoveredClimbIdx;

  const xScale = useXAxisScale();
  const yScale = useYAxisScale('elevation');
  const plotArea = usePlotArea();

  if (!xScale || !yScale || !plotArea || !data.length || !climbTimeRanges.length) return null;

  const { x: left, y: top, width, height } = plotArea;
  const bottom = top + height;
  const right = left + width;

  // Build pixel coordinates for each elevation data point
  const elevPoints = data
    .map(p => {
      const px = xScale(p.time);
      const py = yScale(p.elevation);
      return px != null && py != null ? { x: px, y: py, time: p.time, elevation: p.elevation } : null;
    })
    .filter((p): p is { x: number; y: number; time: number; elevation: number } => p !== null);

  if (elevPoints.length < 2) return null;

  // Clip path traces the elevation profile then drops to the bottom of the plot area
  const clipPoints = [
    ...elevPoints.map(p => `${p.x},${p.y}`),
    `${right},${bottom}`,
    `${left},${bottom}`,
  ].join(' ');

  return (
    <g>
      <defs>
        <clipPath id="climb-elev-clip">
          <polygon points={clipPoints} />
        </clipPath>
        {climbTimeRanges.map((cr, i) => (
          <linearGradient key={`grad-${i}`} id={`climb-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CATEGORY_COLORS[cr.category]} stopOpacity={CATEGORY_FILL_OPACITY[cr.category]} />
            <stop offset="100%" stopColor={CATEGORY_COLORS[cr.category]} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {/* Gradient fills */}
      {climbTimeRanges.map((cr, i) => {
        const px1 = xScale(cr.x1);
        const px2 = xScale(cr.x2);
        if (px1 == null || px2 == null) return null;
        return (
          <rect
            key={`fill-${i}`}
            x={px1}
            y={top}
            width={Math.max(0, px2 - px1)}
            height={height}
            fill={`url(#climb-grad-${i})`}
            clipPath="url(#climb-elev-clip)"
          />
        );
      })}

      {/* Highlighted strokes over elevation line within climb spans */}
      {climbTimeRanges.map((cr, i) => {
        const spanPoints = elevPoints.filter(
          p => p.time >= cr.x1 && p.time <= cr.x2
        );
        if (spanPoints.length < 2) return null;
        return (
          <polyline
            key={`stroke-${i}`}
            points={spanPoints.map(p => `${p.x},${p.y}`).join(' ')}
            stroke={CATEGORY_COLORS[cr.category]}
            strokeWidth={2.5}
            fill="none"
          />
        );
      })}
    </g>
  );
};

export default ClimbOverlay;
