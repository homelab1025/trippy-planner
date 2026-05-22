import { XMLParser } from 'fast-xml-parser';

export interface RoutePoint {
  lat: number;
  lng: number;
  ele: number;
  time?: Date;
  distance: number; // cumulative distance in meters
}

export interface RouteData {
  points: RoutePoint[];
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

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const parseGPX = (xmlText: string): RouteData => {
  const parsed = xmlParser.parse(xmlText) as Record<string, unknown>;
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

  let totalElevationGain = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].ele - points[i - 1].ele;
    if (diff > 0) totalElevationGain += diff;
  }

  return {
    points,
    totalDistance: points[points.length - 1].distance,
    totalElevationGain,
    name,
  };
};
