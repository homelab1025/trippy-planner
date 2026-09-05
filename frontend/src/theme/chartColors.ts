import type { Climb } from '../utils/climbDetector';

export interface ChartPalette {
  elevationStroke: string;
  elevationGradient: string;
  gridStroke: string;
  axisStroke: string;
  tempStroke: string;
  hoverLine: string;
  hoverDot: string;
  routeLine: string;
  hoverMarker: string;
  debugPin: string;
  accentMuted: string;
  windBaseline: string;
  windAccent: string;
  precipBar: string;
  crosshair: string;
  popupText: string;
  climbCategory: Record<Climb['category'], string>;
  checkpointWaypoint: string;
  checkpointLocked: string;
  checkpointGuide: string;
}

// Derived from frontend/new-ui/DESIGN.md's token set (primary green, secondary
// sage, tertiary ochre, error coral, and the cool-gray neutrals).
export const chartPalette: ChartPalette = {
  elevationStroke: '#256a4e',
  elevationGradient: '#256a4e',
  gridStroke: '#e2e9ec',
  axisStroke: '#707973',
  tempStroke: '#ea9a4e',
  hoverLine: '#707973',
  hoverDot: '#256a4e',
  routeLine: '#256a4e',
  hoverMarker: '#ea9a4e',
  debugPin: '#ba1a1a',
  accentMuted: '#707973',
  windBaseline: '#c7eab8',
  windAccent: '#48663f',
  precipBar: '#256a4e',
  crosshair: '#707973',
  popupText: '#161d1f',
  climbCategory: {
    Cat4: '#ADCF9F',
    Cat3: '#76BA99',
    Cat2: '#F2A154',
    Cat1: '#8d4f01',
    HC: '#ba1a1a',
  },
  checkpointWaypoint: '#1b6ec2',
  checkpointLocked: '#256a4e',
  checkpointGuide: '#9aa4a0',
};
