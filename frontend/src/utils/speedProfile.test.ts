import { describe, it, expect } from 'vitest';
import { buildSequence, computeArrivalTime, impliedSpeedKmh, defaultCheckpoints } from './speedProfile';
import type { Checkpoint } from './speedProfile';

const START = new Date('2026-06-03T08:00:00Z');

describe('defaultCheckpoints', () => {
  it('returns a single pinned=false end checkpoint at the full distance', () => {
    const cps = defaultCheckpoints(20_000, 20, START);
    expect(cps).toHaveLength(1);
    expect(cps[0]).toMatchObject({ id: 'end', distanceM: 20_000, pinned: false });
    expect(cps[0].arrivalTime.getTime()).toBe(START.getTime() + 3_600_000); // 20km @ 20km/h = 1h
  });
});

describe('buildSequence', () => {
  it('prepends a synthesized start point and sorts by distance', () => {
    const cps: Checkpoint[] = [
      { id: 'end', distanceM: 10_000, arrivalTime: new Date(START.getTime() + 3_600_000), pinned: false },
      { id: 'mid', distanceM: 5_000, arrivalTime: new Date(START.getTime() + 1_800_000), pinned: true },
    ];
    const seq = buildSequence(START, cps);
    expect(seq.map(p => p.distanceM)).toEqual([0, 5_000, 10_000]);
    expect(seq[0].arrivalTime).toBe(START);
  });
});

describe('computeArrivalTime', () => {
  const endOnly: Checkpoint[] = [
    { id: 'end', distanceM: 20_000, arrivalTime: new Date(START.getTime() + 3_600_000), pinned: false },
  ];

  it('matches the old constant-speed formula when only the end checkpoint exists', () => {
    // 20km route, 1h total => 20km/h constant; at 5km the old formula gives +15min
    const t = computeArrivalTime(5_000, START, endOnly);
    expect(t.getTime()).toBe(START.getTime() + 900_000);
  });

  it('clamps to start time at or before distance 0', () => {
    expect(computeArrivalTime(0, START, endOnly).getTime()).toBe(START.getTime());
    expect(computeArrivalTime(-100, START, endOnly).getTime()).toBe(START.getTime());
  });

  it('clamps to the end checkpoint time at or beyond the total distance', () => {
    const end = endOnly[0].arrivalTime.getTime();
    expect(computeArrivalTime(20_000, START, endOnly).getTime()).toBe(end);
    expect(computeArrivalTime(50_000, START, endOnly).getTime()).toBe(end);
  });

  it('interpolates within the correct segment when a waypoint is pinned partway', () => {
    const cps: Checkpoint[] = [
      { id: 'mid', distanceM: 10_000, arrivalTime: new Date(START.getTime() + 1_800_000), pinned: true }, // 10km @ 30min
      { id: 'end', distanceM: 20_000, arrivalTime: new Date(START.getTime() + 7_200_000), pinned: false }, // +90min more, slower
    ];
    // Halfway through the first segment (5km): half of 30min = 15min
    expect(computeArrivalTime(5_000, START, cps).getTime()).toBe(START.getTime() + 900_000);
    // Halfway through the second segment (15km): 30min + half of 90min = 75min
    expect(computeArrivalTime(15_000, START, cps).getTime()).toBe(START.getTime() + 75 * 60_000);
  });
});

describe('impliedSpeedKmh', () => {
  it('computes km/h between two sequence points', () => {
    const a = { distanceM: 0, arrivalTime: START };
    const b = { distanceM: 10_000, arrivalTime: new Date(START.getTime() + 1_800_000) }; // 10km in 30min
    expect(impliedSpeedKmh(a, b)).toBeCloseTo(20, 6);
  });

  it('returns null when the time span is zero or negative', () => {
    const a = { distanceM: 0, arrivalTime: START };
    const b = { distanceM: 10_000, arrivalTime: START };
    expect(impliedSpeedKmh(a, b)).toBeNull();
    const c = { distanceM: 10_000, arrivalTime: new Date(START.getTime() - 1000) };
    expect(impliedSpeedKmh(a, c)).toBeNull();
  });
});
