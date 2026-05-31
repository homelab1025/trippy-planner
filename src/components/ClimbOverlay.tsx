import React from 'react';
import type { ClimbTimeRange } from './WeatherTimeline';

interface ClimbOverlayProps {
  climbTimeRanges: ClimbTimeRange[];
  hoveredClimbIdx: number | null;
  onHoverClimb: (idx: number | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formattedGraphicalItems?: any[];
  offset?: { top: number; left: number; width: number; height: number };
}

const ClimbOverlay: React.FC<ClimbOverlayProps> = () => null;

export default ClimbOverlay;
