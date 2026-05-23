import { XMLParser } from 'fast-xml-parser';
import { haversineMeters } from './haversineMeters';
import { douglasPeucker, fillGaps } from './douglasPeucker';

export interface RoutePoint {
  lat: number;
  lng: number;
  ele: number;
  time?: Date;
  distance: number; // cumulative distance in meters
}

export interface RouteData {
  points: RoutePoint[];
  originalPointCount: number;
  totalDistance: number;
  totalElevationGain: number;
  name: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Ensure trk/trkseg/trkpt are always arrays even when there's only one element
  isArray: (name) => ['trk', 'trkseg', 'trkpt'].includes(name),
});


export const parseGPX = (xmlText: string, epsilon: number, maxGapMeters: number): RouteData => {
  let t0 = performance.now();
  const parsed = xmlParser.parse(xmlText) as Record<string, unknown>;
  console.log(`[gpx] xml-parse: ${(performance.now() - t0).toFixed(2)}ms`);

  const gpx = parsed['gpx'] as Record<string, unknown> | undefined;
  const tracks = gpx?.['trk'] as unknown[] | undefined;

  if (!tracks || tracks.length === 0) {
    throw new Error('No tracks found in GPX file');
  }

  const trk = tracks[0] as Record<string, unknown>;
  const name = trk['name'] != null ? String(trk['name']) : 'Untitled Route';

  const points: RoutePoint[] = [];
  for (const seg of ((trk['trkseg'] as unknown[]) ?? [])) {
    const s = seg as Record<string, unknown>;
    for (const rawPt of ((s['trkpt'] as unknown[]) ?? [])) {
      const pt = rawPt as Record<string, unknown>;
      const lat = parseFloat(pt['@_lat'] as string);
      const lng = parseFloat(pt['@_lon'] as string);
      const ele = pt['ele'] != null ? Number(pt['ele']) : 0;
      const timeStr = pt['time'] as string | undefined;
      const prev = points[points.length - 1];
      const distance = prev
        ? prev.distance + haversineMeters(prev.lat, prev.lng, lat, lng)
        : 0;
      points.push({ lat, lng, ele, distance, time: timeStr ? new Date(timeStr) : undefined });
    }
  }

  if (points.length === 0) {
    throw new Error('No track points found in GPX file');
  }

  t0 = performance.now();
  let totalElevationGain = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].ele - points[i - 1].ele;
    if (diff > 0) totalElevationGain += diff;
  }
  console.log(`[gpx] elev-calc: ${(performance.now() - t0).toFixed(2)}ms`);

  const totalDistance = points[points.length - 1].distance;
  const originalPointCount = points.length;

  t0 = performance.now();
  const simplified = douglasPeucker(points, epsilon);
  console.log(`[gpx] dp-simplify: ${(performance.now() - t0).toFixed(2)}ms`);

  t0 = performance.now();
  const decimated = fillGaps(points, simplified, maxGapMeters);
  console.log(`[gpx] fill-gaps: ${(performance.now() - t0).toFixed(2)}ms`);

  return {
    points: decimated,
    originalPointCount,
    totalDistance,
    totalElevationGain,
    name,
  };
};
