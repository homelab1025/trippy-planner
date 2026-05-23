import type { RoutePoint } from './gpxParser';
import { haversineMeters, EARTH_RADIUS_METERS } from './haversineMeters';

export const DP_EPSILON_METERS = 5;

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

  const sinXT = Math.sin(dAP / EARTH_RADIUS_METERS) * Math.sin(thetaAP - thetaAB);
  const dXT = Math.asin(Math.max(-1, Math.min(1, sinXT))) * EARTH_RADIUS_METERS;

  const cosXT = Math.cos(dXT / EARTH_RADIUS_METERS);
  const dAT =
    cosXT === 0
      ? 0
      : Math.acos(Math.max(-1, Math.min(1, Math.cos(dAP / EARTH_RADIUS_METERS) / cosXT))) * EARTH_RADIUS_METERS;

  if (dAT > dAB) {
    const dBP = haversineMeters(b.lat, b.lng, p.lat, p.lng);
    return Math.min(dAP, dBP);
  }

  return Math.abs(dXT);
}

export function douglasPeucker(points: RoutePoint[], epsilon: number): RoutePoint[] {
  if (points.length === 0) return [];

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end - start <= 1) continue;

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
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}
