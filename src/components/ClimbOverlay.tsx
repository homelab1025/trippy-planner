import React, { useState } from 'react';
import { useXAxisScale, useYAxisScale, usePlotArea } from 'recharts';
import type { ClimbTimeRange } from './WeatherTimeline';

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
  const xScale = useXAxisScale();
  const yScale = useYAxisScale('elevation');
  const plotArea = usePlotArea();

  // hooks and state used in Tasks 2–5
  void hoveredClimbIdx; void setHoveredClimbIdx; void xScale; void yScale; void plotArea; void climbTimeRanges; void data;

  return null;
};

export default ClimbOverlay;
