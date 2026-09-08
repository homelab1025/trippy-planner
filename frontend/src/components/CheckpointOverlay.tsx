import React from 'react';
import { useXAxisScale, useYAxisScale, usePlotArea } from 'recharts';
import type { Checkpoint } from '../utils/speedProfile';
import { chartPalette } from '../theme/chartColors';

interface ElevDataPoint {
  distance: number; // km
  elevation: number;
}

interface CheckpointOverlayProps {
  checkpoints: Checkpoint[];
  data: ElevDataPoint[];
}

const CheckpointOverlay: React.FC<CheckpointOverlayProps> = ({ checkpoints, data }) => {
  const palette = chartPalette;
  const xScale = useXAxisScale();
  const yScale = useYAxisScale('elevation');
  const plotArea = usePlotArea();

  if (!xScale || !yScale || !plotArea || !data.length) return null;

  const elevationAtKm = (km: number): number | null => {
    for (let i = 0; i < data.length - 1; i++) {
      const a = data[i], b = data[i + 1];
      if (km >= a.distance && km <= b.distance) {
        const span = b.distance - a.distance;
        const frac = span > 0 ? (km - a.distance) / span : 0;
        return a.elevation + frac * (b.elevation - a.elevation);
      }
    }
    return data[data.length - 1]?.elevation ?? null;
  };

  const points = [
    { distanceKm: 0, locked: true },
    ...checkpoints
      .slice()
      .sort((a, b) => a.distanceM - b.distanceM)
      .map(cp => ({ distanceKm: cp.distanceM / 1000, locked: cp.id === 'end' })),
  ];

  return (
    <g>
      {points.map((p, i) => {
        const px = xScale(p.distanceKm);
        const ele = elevationAtKm(p.distanceKm);
        if (typeof px !== 'number' || ele === null) return null;
        const py = yScale(ele);
        if (typeof py !== 'number') return null;
        return (
          <g key={i}>
            <line
              x1={px} y1={py} x2={px} y2={plotArea.y + plotArea.height}
              stroke={palette.checkpointGuide} strokeWidth={1} strokeDasharray="3 3"
            />
            <circle
              cx={px} cy={py} r={4}
              fill={p.locked ? palette.checkpointLocked : palette.checkpointWaypoint}
              stroke="white" strokeWidth={1.5}
            />
            {!p.locked && (() => {
              const label = `${p.distanceKm.toFixed(1)} km`;
              // A pill anchored just above the axis line, inside the plot area — the
              // default XAxis tick row lives just below that line (its own text sits
              // right under it), so putting our label there instead of below it avoids
              // colliding with/overlapping the default "N km" tick labels.
              const badgeWidth = 8 + label.length * 5.2;
              const badgeHeight = 14;
              const badgeY = plotArea.y + plotArea.height - badgeHeight - 2;
              return (
                <g>
                  <rect
                    x={px - badgeWidth / 2}
                    y={badgeY}
                    width={badgeWidth}
                    height={badgeHeight}
                    rx={7}
                    fill={palette.checkpointWaypoint}
                  />
                  <text
                    x={px}
                    y={badgeY + badgeHeight - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={600}
                    fill="white"
                  >
                    {label}
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}
    </g>
  );
};

export { CheckpointOverlay };
