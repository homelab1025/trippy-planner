export interface Checkpoint {
  id: string;
  distanceM: number;
  arrivalTime: Date;
  pinned: boolean;
}

interface SequencePoint {
  distanceM: number;
  arrivalTime: Date;
}

export function buildSequence(startTime: Date, checkpoints: Checkpoint[]): SequencePoint[] {
  const start: SequencePoint = { distanceM: 0, arrivalTime: startTime };
  const rest = checkpoints
    .map(cp => ({ distanceM: cp.distanceM, arrivalTime: cp.arrivalTime }))
    .sort((a, b) => a.distanceM - b.distanceM);
  return [start, ...rest];
}

export function computeArrivalTime(distanceM: number, startTime: Date, checkpoints: Checkpoint[]): Date {
  const seq = buildSequence(startTime, checkpoints);
  if (distanceM <= seq[0].distanceM) return seq[0].arrivalTime;
  const last = seq[seq.length - 1];
  if (distanceM >= last.distanceM) return last.arrivalTime;

  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i];
    const b = seq[i + 1];
    if (distanceM >= a.distanceM && distanceM <= b.distanceM) {
      const span = b.distanceM - a.distanceM;
      const frac = span > 0 ? (distanceM - a.distanceM) / span : 0;
      return new Date(a.arrivalTime.getTime() + frac * (b.arrivalTime.getTime() - a.arrivalTime.getTime()));
    }
  }
  return last.arrivalTime;
}

export function impliedSpeedKmh(a: SequencePoint, b: SequencePoint): number | null {
  const hours = (b.arrivalTime.getTime() - a.arrivalTime.getTime()) / 3_600_000;
  if (hours <= 0) return null;
  return (b.distanceM - a.distanceM) / 1000 / hours;
}

// Revives a persisted checkpoints payload (localStorage mirror, saved route, share link).
// Returns `undefined` — never `[]` — for anything unusable, so callers' `?? defaultCheckpoints(...)`
// fallback actually engages. An empty array would silently satisfy `??` and leave the route with
// no 'end' checkpoint at all, breaking the invariant that one always exists at the route's end.
export function parseCheckpointsJson(json: string): Checkpoint[] | undefined {
  try {
    const raw = JSON.parse(json) as { id: string; distanceM: number; arrivalTime: string; pinned: boolean }[];
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const revived = raw
      .map(cp => ({ ...cp, arrivalTime: new Date(cp.arrivalTime) }))
      .filter(cp => !Number.isNaN(cp.arrivalTime.getTime()));
    return revived.length > 0 ? revived : undefined;
  } catch {
    return undefined;
  }
}

export function defaultCheckpoints(totalDistanceM: number, avgSpeedKmh: number, startTime: Date): Checkpoint[] {
  const hours = totalDistanceM / 1000 / avgSpeedKmh;
  return [{
    id: 'end',
    distanceM: totalDistanceM,
    arrivalTime: new Date(startTime.getTime() + hours * 3_600_000),
    pinned: false,
  }];
}
