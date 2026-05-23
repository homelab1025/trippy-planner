import type { RoutePoint } from './gpxParser';

export const DP_EPSILON_METERS = 5;

const R = 6_371_000;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLng = (lng2 - lng1) * rad;
  const y = Math.sin(dLng) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(dLng);
  return Math.atan2(y, x);
}

function perpDistanceMeters(p: RoutePoint, a: RoutePoint, b: RoutePoint): number {
  const dAB = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  if (dAB === 0) return haversineMeters(a.lat, a.lng, p.lat, p.lng);

  const dAP = haversineMeters(a.lat, a.lng, p.lat, p.lng);
  const thetaAP = haversineBearing(a.lat, a.lng, p.lat, p.lng);
  const thetaAB = haversineBearing(a.lat, a.lng, b.lat, b.lng);

  const sinXT = Math.sin(dAP / R) * Math.sin(thetaAP - thetaAB);
  const dXT = Math.asin(Math.max(-1, Math.min(1, sinXT))) * R;

  const cosXT = Math.cos(dXT / R);
  const dAT =
    cosXT === 0
      ? 0
      : Math.acos(Math.max(-1, Math.min(1, Math.cos(dAP / R) / cosXT))) * R;

  if (dAT > dAB) {
    const dBP = haversineMeters(b.lat, b.lng, p.lat, p.lng);
    return Math.min(dAP, dBP);
  }

  return Math.abs(dXT);
}

function simplify(
  points: RoutePoint[],
  start: number,
  end: number,
  epsilon: number,
  keep: boolean[]
): void {
  if (end - start <= 1) return;

  let maxDist = 0;
  let maxIdx = start + 1;
  for (let i = start + 1; i < end; i++) {
    const d = perpDistanceMeters(points[i], points[start], points[end]);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    keep[maxIdx] = true;
    simplify(points, start, maxIdx, epsilon, keep);
    simplify(points, maxIdx, end, epsilon, keep);
  }
}

export function douglasPeucker(points: RoutePoint[], epsilon: number): RoutePoint[] {
  if (points.length === 0) return [];

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  simplify(points, 0, points.length - 1, epsilon, keep);

  return points.filter((_, i) => keep[i]);
}
