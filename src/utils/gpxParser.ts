import gpxParser from 'gpxparser';

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

export const parseGPX = (xmlText: string): RouteData => {
  const gpx = new gpxParser();
  gpx.parse(xmlText);

  if (gpx.tracks.length === 0) {
    throw new Error('No tracks found in GPX file');
  }

  const track = gpx.tracks[0];
  const points: RoutePoint[] = track.points.map((p, i) => ({
    lat: p.lat,
    lng: p.lon,
    ele: p.ele || 0,
    time: p.time,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    distance: i === 0 ? 0 : (track.distance as any).cumul[i - 1],
  }));

  // Calculate elevation gain
  let totalElevationGain = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].ele - points[i - 1].ele;
    if (diff > 0) totalElevationGain += diff;
  }

  return {
    points,
    totalDistance: track.distance.total,
    totalElevationGain,
    name: track.name || 'Untitled Route',
  };
};
