import { describe, it, expect } from 'vitest';
import { parseGPX } from './gpxParser';
import { DP_EPSILON_METERS } from './douglasPeucker';

// Build a minimal GPX XML string from parts
const gpx = (name: string, trkpts: string) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    ${name ? `<name>${name}</name>` : ''}
    <trkseg>${trkpts}</trkseg>
  </trk>
</gpx>`;

const pt = (lat: number, lon: number, ele?: number) =>
  `<trkpt lat="${lat}" lon="${lon}">${ele !== undefined ? `<ele>${ele}</ele>` : ''}</trkpt>`;

// Five points: gains are 35→40 (+5) and 38→45 (+7), descents are ignored → totalElevationGain = 12m
const VALID = gpx('Test Route', [
  pt(48.8566, 2.3522, 35),
  pt(48.8600, 2.3600, 40),
  pt(48.8550, 2.3650, 38),
  pt(48.8520, 2.3700, 45),
  pt(48.8500, 2.3750, 42),
].join('\n'));

describe('parseGPX', () => {
  it('returns correct name, point count, and elevation gain for a valid GPX', () => {
    const result = parseGPX(VALID, DP_EPSILON_METERS, Infinity);
    expect(result.name).toBe('Test Route');
    expect(result.points).toHaveLength(5);
    expect(result.originalPointCount).toBe(5);
    expect(result.totalElevationGain).toBeCloseTo(12, 0);
  });

  it('first point has distance 0 and subsequent distances increase monotonically', () => {
    const { points } = parseGPX(VALID, DP_EPSILON_METERS, Infinity);
    expect(points[0].distance).toBe(0);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].distance).toBeGreaterThan(points[i - 1].distance);
    }
  });

  it('elevation gain only counts positive deltas — descents are not subtracted', () => {
    const descending = gpx('Descent', [
      pt(48.85, 2.35, 100),
      pt(48.86, 2.36, 80),
      pt(48.87, 2.37, 60),
    ].join('\n'));
    expect(parseGPX(descending, DP_EPSILON_METERS, Infinity).totalElevationGain).toBe(0);
  });

  it('defaults elevation to 0 when ele attribute is absent', () => {
    const noEle = gpx('No Ele', [
      pt(48.85, 2.35),
      pt(48.86, 2.36),
    ].join('\n'));
    const { points } = parseGPX(noEle, DP_EPSILON_METERS, Infinity);
    expect(points[0].ele).toBe(0);
    expect(points[1].ele).toBe(0);
  });

  it('falls back to "Untitled Route" when track name is missing', () => {
    const noName = gpx('', [
      pt(48.85, 2.35, 10),
      pt(48.86, 2.36, 10),
    ].join('\n'));
    expect(parseGPX(noName, DP_EPSILON_METERS, Infinity).name).toBe('Untitled Route');
  });

  it('throws when the GPX file contains no tracks', () => {
    expect(() => parseGPX(`<?xml version="1.0"?><gpx version="1.1"></gpx>`, DP_EPSILON_METERS, Infinity))
      .toThrow('No tracks found in GPX file');
  });

  it('computes haversine distance to within 1 m for a two-point route', () => {
    const twoPoint = gpx('D', [pt(1, 1), pt(2, 2)].join('\n'));
    expect(parseGPX(twoPoint, DP_EPSILON_METERS, Infinity).totalDistance).toBeCloseTo(157_225.43, 0);
  });

  it('records original point count and decimates collinear points on a meridian', () => {
    const MERIDIAN = gpx('Meridian', [
      pt(0, 10, 0),
      pt(0.25, 10, 0),
      pt(0.5, 10, 0),
      pt(0.75, 10, 0),
      pt(1, 10, 0),
    ].join('\n'));
    // Pass Infinity so fillGaps does not re-insert points — this test only checks DP behaviour
    const result = parseGPX(MERIDIAN, DP_EPSILON_METERS, Infinity);
    expect(result.originalPointCount).toBe(5);
    expect(result.points.length).toBeLessThan(result.originalPointCount);
    expect(result.points[0].lat).toBeCloseTo(0, 5);
    expect(result.points[result.points.length - 1].lat).toBeCloseTo(1, 5);
  });

  it('fillGaps re-inserts points on a collinear meridian when maxGapMeters is smaller than the route', () => {
    // 5 collinear points; DP collapses to 2 endpoints (~111 km total)
    // maxGapMeters = 40_000 m (40 km) → gap 111 km gets inserts
    const MERIDIAN = gpx('Meridian', [
      pt(0, 10, 0),
      pt(0.25, 10, 0),
      pt(0.5, 10, 0),
      pt(0.75, 10, 0),
      pt(1, 10, 0),
    ].join('\n'));
    const result = parseGPX(MERIDIAN, DP_EPSILON_METERS, 40_000);
    expect(result.points.length).toBeGreaterThan(2);
    expect(result.points[0].lat).toBeCloseTo(0, 5);
    expect(result.points[result.points.length - 1].lat).toBeCloseTo(1, 5);
  });
});
