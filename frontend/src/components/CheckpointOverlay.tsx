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
  startTime: Date;
  data: ElevDataPoint[];
}

const CheckpointOverlay: React.FC<CheckpointOverlayProps> = ({ checkpoints, startTime, data }) => {
  // startTime is accepted for interface symmetry with future overlay work (see
  // ElevationChart's CheckpointOverlay usage); this purely-decorative overlay
  // doesn't compute arrival-time labels yet, so it isn't read here.
  void startTime;
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
          </g>
        );
      })}
    </g>
  );
};

export { CheckpointOverlay };
