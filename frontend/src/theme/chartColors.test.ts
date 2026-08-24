import { describe, it, expect } from 'vitest';
import { getChartPalette } from './chartColors';

describe('getChartPalette', () => {
  it('returns the current (emerald) palette when isNewUi is false', () => {
    const palette = getChartPalette(false);
    expect(palette.elevationStroke).toBe('#2d5a27');
    expect(palette.routeLine).toBe('#2d5a27');
    expect(palette.debugPin).toBe('#e53e3e');
    expect(palette.climbCategory.HC).toBe('#7B0099');
  });

  it('returns the alpine palette when isNewUi is true', () => {
    const palette = getChartPalette(true);
    expect(palette.elevationStroke).toBe('#256a4e');
    expect(palette.routeLine).toBe('#256a4e');
    expect(palette.debugPin).toBe('#ba1a1a');
    expect(palette.climbCategory.HC).toBe('#ba1a1a');
  });

  it('defines every climb category for both palettes', () => {
    const categories: Array<'Cat4' | 'Cat3' | 'Cat2' | 'Cat1' | 'HC'> = ['Cat4', 'Cat3', 'Cat2', 'Cat1', 'HC'];
    for (const isNewUi of [false, true]) {
      const palette = getChartPalette(isNewUi);
      for (const category of categories) {
        expect(palette.climbCategory[category]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});
