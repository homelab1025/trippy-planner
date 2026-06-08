import React, { useRef, useState, useLayoutEffect } from 'react';
import { Wind } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, ReferenceLine, useXAxisScale,
} from 'recharts';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { CHART_MARGIN_LEFT, CHART_YAXIS_LEFT_WIDTH } from './ElevationChart';

const CHART_MARGIN_RIGHT = 55;

interface WindArrowRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  hoveredDistance?: number | null;
}

interface WindArrowsLayerProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  containerWidth?: number;
}

function buildFallbackScale(
  containerWidth: number,
  distanceRange: [number, number],
): (v: number) => number {
  const [dMin, dMax] = distanceRange;
  const plotLeft = CHART_MARGIN_LEFT;
  const plotRight = containerWidth - CHART_MARGIN_RIGHT;
  const plotWidth = Math.max(plotRight - plotLeft, 0);
  return (v: number) => plotLeft + ((v - dMin) / (dMax - dMin)) * plotWidth;
}

const WindArrowsLayer: React.FC<WindArrowsLayerProps> = ({ samplePoints, distanceRange, containerWidth }) => {
  const rechartsXScale = useXAxisScale();
  const [dMin, dMax] = distanceRange;

  // Prefer the Recharts-provided scale; fall back to a computed linear scale when
  // the Recharts hook returns undefined (e.g. React 19 subscription timing issues).
  const xScale: ((v: number) => number | undefined) | null =
    rechartsXScale ?? (containerWidth != null && containerWidth > 0
      ? buildFallbackScale(containerWidth, distanceRange)
      : null);

  if (!xScale) return null;

  const baselineX1 = xScale(dMin);
  const baselineX2 = xScale(dMax);
  if (baselineX1 == null || baselineX2 == null) return null;
  return (
    <>
      <line
        x1={baselineX1} y1={22}
        x2={baselineX2} y2={22}
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    const initialWidth = el.getBoundingClientRect().width;
    if (initialWidth > 0) setContainerWidth(initialWidth);
    return () => ro.disconnect();
  // Re-run when component transitions from empty to non-empty (containerRef becomes populated)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samplePoints.length > 0]);

  if (!samplePoints.length) return null;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
        color: '#94a3b8', pointerEvents: 'none',
      }}>
        <Wind size={14} />
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 0, right: CHART_MARGIN_RIGHT, left: CHART_MARGIN_LEFT, bottom: 0 }}>
          <XAxis hide type="number" domain={distanceRange} allowDataOverflow />
          <YAxis hide width={CHART_YAXIS_LEFT_WIDTH} />
          <WindArrowsLayer
            samplePoints={samplePoints}
            distanceRange={distanceRange}
            containerWidth={containerWidth}
          />
          {hoveredDistance != null && (
            <ReferenceLine x={hoveredDistance} stroke="#aaa" strokeDasharray="3 3" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WindArrowRow;
