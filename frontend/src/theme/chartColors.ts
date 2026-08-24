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
}

// Current appearance — unchanged from what the components hardcoded before.
const emerald: ChartPalette = {
  elevationStroke: '#2d5a27',
  elevationGradient: '#2d5a27',
  gridStroke: '#eee',
  axisStroke: '#888',
  tempStroke: '#ff7300',
  hoverLine: '#aaa',
  hoverDot: '#2d5a27',
  routeLine: '#2d5a27',
  hoverMarker: '#FF6B00',
  debugPin: '#e53e3e',
  accentMuted: '#94a3b8',
  windBaseline: '#bfdbfe',
  windAccent: '#3b82f6',
  precipBar: '#3b82f6',
  crosshair: '#aaa',
  popupText: '#444',
  climbCategory: {
    Cat4: '#F5C518',
    Cat3: '#F5A623',
    Cat2: '#E8601C',
    Cat1: '#D0021B',
    HC: '#7B0099',
  },
};

// Derived from frontend/new-ui/DESIGN.md's token set (primary green, secondary
// sage, tertiary ochre, error coral, and the cool-gray neutrals).
const alpine: ChartPalette = {
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
};

export function getChartPalette(isNewUi: boolean): ChartPalette {
  return isNewUi ? alpine : emerald;
}
