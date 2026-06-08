import React, { useRef, useState, useLayoutEffect } from 'react';
import { CloudRain } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, ReferenceLine, useXAxisScale,
} from 'recharts';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { CHART_MARGIN_LEFT, CHART_YAXIS_LEFT_WIDTH } from './ElevationChart';

const MAX_BAR_HEIGHT = 28;
const BAR_BOTTOM_Y = 36;
const BAR_GAP = 2;
const CHART_MARGIN_RIGHT = 55;

interface PrecipBarRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  hoveredDistance?: number | null;
}

interface PrecipBarsLayerProps {
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

const PrecipBarsLayer: React.FC<PrecipBarsLayerProps> = ({ samplePoints, distanceRange, containerWidth }) => {
  const rechartsXScale = useXAxisScale();
  const [dMin, dMax] = distanceRange;

  // Prefer the Recharts-provided scale; fall back to a computed linear scale when
  // the Recharts hook returns undefined (e.g. React 19 subscription timing issues).
  const xScale: ((v: number) => number | undefined) | null =
    rechartsXScale ?? (containerWidth != null && containerWidth > 0
      ? buildFallbackScale(containerWidth, distanceRange)
      : null);

  if (!xScale) return null;

  const maxPrecip = Math.max(...samplePoints.map(p => p.precipitation ?? 0), 1);
  const edges = [dMin, ...samplePoints.map(p => p.distance), dMax];

  return (
    <>
      {edges.slice(0, -1).map((startDist, i) => {
        const endDist = edges[i + 1];
        const sample = samplePoints[Math.max(0, i - 1)];
        const precip = sample.precipitation ?? 0;
        const prob = sample.precipProb ?? 0;
        const barHeight = Math.max((precip / maxPrecip) * MAX_BAR_HEIGHT, 2);
        const opacity = Math.max(prob / 100, 0.05);
        const x1 = xScale(startDist);
        const x2 = xScale(endDist);
        if (x1 == null || x2 == null) return null;
        const barWidth = Math.max(x2 - x1 - BAR_GAP, 1);
        return (
          <rect
            key={i}
            data-testid="precip-bar"
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
    </>
  );
};

const PrecipBarRow: React.FC<PrecipBarRowProps> = ({ samplePoints, distanceRange, hoveredDistance }) => {
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
        <CloudRain size={14} />
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 0, right: CHART_MARGIN_RIGHT, left: CHART_MARGIN_LEFT, bottom: 0 }}>
          <XAxis hide type="number" domain={distanceRange} allowDataOverflow />
          <YAxis hide width={CHART_YAXIS_LEFT_WIDTH} />
          <PrecipBarsLayer
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

export default PrecipBarRow;
