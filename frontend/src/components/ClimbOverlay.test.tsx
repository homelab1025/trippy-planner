// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { ClimbOverlay, type ClimbRange } from './ClimbOverlay';

// The overlay reads its geometry from recharts' scale/plot-area hooks. Mock them
// with controlled values so we can reason about exact pixel positions.
const mocks = vi.hoisted(() => ({
  xScale: (v: number) => v,
  yScale: (v: number) => v,
  plotArea: { x: 0, y: 0, width: 0, height: 0 } as { x: number; y: number; width: number; height: number },
}));

vi.mock('recharts', () => ({
  useXAxisScale: () => mocks.xScale,
  useYAxisScale: () => mocks.yScale,
  usePlotArea: () => mocks.plotArea,
}));

// Plot area: left=10, top=10, right=810, bottom=310.
const PLOT = { x: 10, y: 10, width: 800, height: 300 };
// elevation 0 -> y=310 (bottom), elevation 1000 -> y=10 (top)
const yScale = (elev: number) => 310 - (elev / 1000) * 300;
// distance 0 -> x=10 (left), distance 100 -> x=810 (right)
const xScale = (dist: number) => 10 + (dist / 100) * 800;

const data = [
  { distance: 0, elevation: 0 },
  { distance: 25, elevation: 500 },
  { distance: 50, elevation: 1000 },
  { distance: 75, elevation: 500 },
  { distance: 100, elevation: 0 },
];

function makeClimb(x1: number, x2: number): ClimbRange {
  return {
    startDistance: x1 * 1000,
    endDistance: x2 * 1000,
    elevationGain: 1000,
    lengthM: (x2 - x1) * 1000,
    avgGrade: 2,
    score: 100000,
    category: 'HC',
    x1,
    x2,
  };
}

function badgeY(container: HTMLElement): number {
  const badge = container.querySelector('rect[rx="8"]');
  expect(badge).not.toBeNull();
  return Number(badge!.getAttribute('y'));
}

describe('ClimbOverlay badge positioning', () => {
  beforeEach(() => {
    mocks.xScale = xScale;
    mocks.yScale = yScale;
    mocks.plotArea = PLOT;
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the badge inside the plot area when the peak is the route high point (near the top)', () => {
    // Climb ends at distance 50 -> peak elevation 1000 -> y=10 (the plot-area top).
    const { container } = render(<ClimbOverlay climbRanges={[makeClimb(0, 50)]} data={data} />);
    // Without clamping the badge would land at y = 10 - 28 - 16 = -34, above the
    // SVG viewport and clipped. It must instead be clamped to the plot-area top.
    expect(badgeY(container)).toBeGreaterThanOrEqual(PLOT.y);
  });

  it('places the badge above the peak when there is room', () => {
    // Climb ends at distance 25 -> peak elevation 500 -> y=160, well below the top.
    const { container } = render(<ClimbOverlay climbRanges={[makeClimb(0, 25)]} data={data} />);
    // 160 - poleHeight(28) - badgeHeight(16) = 116
    expect(badgeY(container)).toBeCloseTo(160 - 28 - 16);
  });

  it('does not draw an inverted pole when the peak sits at the clamped badge', () => {
    // Peak exactly at the top (y=10); badge clamped to the top too, so the pole
    // would otherwise run downward from the peak.
    const { container } = render(<ClimbOverlay climbRanges={[makeClimb(0, 50)]} data={data} />);
    const pole = container.querySelector('line[stroke-dasharray="3 2"]');
    if (pole) {
      const y1 = Number(pole.getAttribute('y1'));
      const y2 = Number(pole.getAttribute('y2'));
      // The pole must run upward (y2 < y1) or be absent, never downward.
      expect(y2).toBeLessThan(y1);
    }
  });
});
