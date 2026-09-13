export const CHART_MARGIN_LEFT = 10;
export const CHART_YAXIS_LEFT_WIDTH = 45;

// Fixed height of the elevation row (App.tsx) and the margin/axis allocation
// ElevationChart gives its ComposedChart. Kept as constants (rather than
// measured at runtime) so the Y-axis headroom reserved for climb badges
// below can be computed without waiting for a layout pass.
export const CHART_HEIGHT = 300;
export const CHART_MARGIN_TOP = 10;
export const CHART_XAXIS_HEIGHT = 30; // recharts' default rendered XAxis height
export const ELEVATION_PLOT_HEIGHT = CHART_HEIGHT - CHART_MARGIN_TOP - CHART_XAXIS_HEIGHT;

// Climb badge geometry, shared between ClimbOverlay (which draws the badge)
// and ElevationChart (which reserves Y-axis headroom so the badge for the
// route's highest climb never needs to be clamped into the plot area).
export const CLIMB_BADGE_HEIGHT = 16;
export const CLIMB_POLE_HEIGHT = 28;
