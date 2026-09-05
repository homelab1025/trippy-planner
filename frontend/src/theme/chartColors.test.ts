import { describe, it, expect } from 'vitest';
import { chartPalette } from './chartColors';

describe('chartPalette', () => {
  it('exposes the alpine palette colors', () => {
    expect(chartPalette.elevationStroke).toBe('#256a4e');
    expect(chartPalette.routeLine).toBe('#256a4e');
    expect(chartPalette.debugPin).toBe('#ba1a1a');
    expect(chartPalette.climbCategory.HC).toBe('#ba1a1a');
  });

  it('defines every climb category with a valid hex color', () => {
    const categories: Array<'Cat4' | 'Cat3' | 'Cat2' | 'Cat1' | 'HC'> = ['Cat4', 'Cat3', 'Cat2', 'Cat1', 'HC'];
    for (const category of categories) {
      expect(chartPalette.climbCategory[category]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('defines checkpoint marker colors', () => {
    expect(chartPalette.checkpointWaypoint).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(chartPalette.checkpointLocked).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(chartPalette.checkpointGuide).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
