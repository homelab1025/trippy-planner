# Wind u/v Interpolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scalar wind speed/direction interpolation with meteorological u/v vector decomposition, and switch the interpolation factor from index-based to time-based.

**Architecture:** All changes are inside `buildChartData` in `src/hooks/useWeatherChartData.ts`. Before the inner `j`-loop, each sample-pair's wind is decomposed into u (eastward) and v (northward) components. Inside the loop, u and v are interpolated linearly and speed/direction are reconstructed from the result. The time-based `t` fix uses the pre-existing `.time` field already populated on non-sample `ChartDataPoint` entries from the constant-speed model.

**Tech Stack:** TypeScript, Vitest

---

## Files

| File | Action |
|------|--------|
| `src/hooks/useWeatherChartData.ts` | Modify lines 79–101 |
| `src/hooks/useWeatherChartData.test.ts` | Update one existing test; add three new tests |

---

### Task 1: Update existing windDeg test and add three failing tests

**Files:**
- Modify: `src/hooks/useWeatherChartData.test.ts`

- [ ] **Step 1: Update the existing `'interpolates windDeg between sample points'` test**

The test uses `windSpeed: 0` — with u/v interpolation, zero-speed wind has no direction, making the expected 90° result meaningless. Replace `0°→180°` at speed 0 with `0°→90°` at `windSpeed: 10`, whose midpoint is 45° with both the old and new code (no regression, but no longer degenerate).

Find and replace the test at lines 91–113:

```ts
it('interpolates windDeg between sample points', () => {
  const pts = [
    { distance: 0, ele: 100 },
    { distance: 1000, ele: 100 },
    { distance: 2000, ele: 100 },
  ];
  const route = makeRoute(pts);
  const makeWP = (idx: number, windDeg: number) => ({
    point: route.points[idx],
    arrivalTime: new Date(START.getTime() + idx * 3_600_000),
    label: String(idx),
    temp: 0, precipProb: 0, precipitation: 0, windSpeed: 10, windDeg,
  });
  const result = buildChartData({
    route,
    weatherPoints: [makeWP(0, 0), makeWP(2, 90)],
    chartWidth: 1000,
    avgSpeed: 20,
    startTime: START,
  });
  const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
  expect(mid?.windDeg).toBeCloseTo(45, 0);
});
```

- [ ] **Step 2: Add test for circular wrapping across the 0/360 boundary**

Append inside the `describe` block:

```ts
it('interpolates wind direction correctly across the 0/360 boundary', () => {
  const pts = [
    { distance: 0, ele: 100 },
    { distance: 1000, ele: 100 },
    { distance: 2000, ele: 100 },
  ];
  const route = makeRoute(pts);
  const makeWP = (idx: number, windDeg: number) => ({
    point: route.points[idx],
    arrivalTime: new Date(START.getTime() + idx * 3_600_000),
    label: String(idx),
    temp: 0, precipProb: 0, precipitation: 0, windSpeed: 10, windDeg,
  });
  // 350° → 10°: correct midpoint is 0° (north); scalar gives 180° (south)
  const result = buildChartData({
    route,
    weatherPoints: [makeWP(0, 350), makeWP(2, 10)],
    chartWidth: 1000,
    avgSpeed: 20,
    startTime: START,
  });
  const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
  const deg = mid?.windDeg ?? 0;
  // 0° and 360° are equivalent; distance from 0° on the circle
  expect(Math.min(deg, 360 - deg)).toBeCloseTo(0, 0);
});
```

- [ ] **Step 3: Add test for speed magnitude through a direction change**

```ts
it('interpolated wind speed reflects vector magnitude, not scalar average', () => {
  const pts = [
    { distance: 0, ele: 100 },
    { distance: 1000, ele: 100 },
    { distance: 2000, ele: 100 },
  ];
  const route = makeRoute(pts);
  const makeWP = (idx: number, windDeg: number, windSpeed: number) => ({
    point: route.points[idx],
    arrivalTime: new Date(START.getTime() + idx * 3_600_000),
    label: String(idx),
    temp: 0, precipProb: 0, precipitation: 0, windSpeed, windDeg,
  });
  // 30 km/h NW (315°) → 30 km/h NE (45°): vector midpoint is ~21.2 km/h N (0°)
  // scalar interpolation would give 30 km/h — wrong
  const result = buildChartData({
    route,
    weatherPoints: [makeWP(0, 315, 30), makeWP(2, 45, 30)],
    chartWidth: 1000,
    avgSpeed: 20,
    startTime: START,
  });
  const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
  expect(mid?.windSpeed).toBeCloseTo(30 / Math.SQRT2, 0); // ≈ 21.2
  expect(mid?.windDeg).toBeCloseTo(0, 0);
});
```

- [ ] **Step 4: Add test for time-based interpolation factor**

```ts
it('uses time-based interpolation factor, not index-based', () => {
  // Route: 3 pts at 0m, 1000m, 2000m. avgSpeed=20 km/h gives model time at pt[1]:
  //   START + (1000 / 20000) * 3_600_000 = START + 180_000ms (3 min)
  // Sample times: sample0=START, sample2=START+1h
  //   → t at pt[1] = 3min / 1h = 0.05, far from 0.5 (index midpoint)
  const pts = [
    { distance: 0, ele: 100 },
    { distance: 1000, ele: 100 },
    { distance: 2000, ele: 100 },
  ];
  const route = makeRoute(pts);
  const result = buildChartData({
    route,
    weatherPoints: [
      {
        point: route.points[0],
        arrivalTime: START,
        label: '0',
        temp: 0, precipProb: 0, precipitation: 0, windSpeed: 0, windDeg: 0,
      },
      {
        point: route.points[2],
        arrivalTime: new Date(START.getTime() + 3_600_000), // 1 hour later
        label: '2',
        temp: 100, precipProb: 0, precipitation: 0, windSpeed: 0, windDeg: 0,
      },
    ],
    chartWidth: 1000,
    avgSpeed: 20,
    startTime: START,
  });
  const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
  // time-based: t ≈ 0.05 → temp ≈ 5
  // index-based: t = 0.5 → temp ≈ 50
  expect(mid?.temp).toBeCloseTo(5, 0);
});
```

- [ ] **Step 5: Run tests and confirm failures**

```bash
npx vitest run src/hooks/useWeatherChartData.test.ts
```

Expected: 3 failures — wrapping test, speed-magnitude test, time-based-t test. The updated `windDeg` test should still pass (0°→90° gives 45° with both old and new code).

---

### Task 2: Implement u/v decomposition and time-based t

**Files:**
- Modify: `src/hooks/useWeatherChartData.ts:79–101`

- [ ] **Step 1: Replace the interpolation block**

Replace the entire loop body (lines 79–102) with:

```ts
  for (let i = 0; i < sampleIdxs.length - 1; i++) {
    const lo = sampleIdxs[i], hi = sampleIdxs[i + 1];
    const tLo = downsampled[lo].temp,    tHi = downsampled[hi].temp;
    const ppLo = downsampled[lo].precipProb, ppHi = downsampled[hi].precipProb;
    const pLo = downsampled[lo].precipitation, pHi = downsampled[hi].precipitation;
    const wsLo = downsampled[lo].windSpeed,  wsHi = downsampled[hi].windSpeed;
    const wdLo = downsampled[lo].windDeg,    wdHi = downsampled[hi].windDeg;
    const timeLo = downsampled[lo].time,    timeHi = downsampled[hi].time;
    if (
      tLo == null || tHi == null || ppLo == null || ppHi == null ||
      pLo == null || pHi == null || wsLo == null || wsHi == null ||
      wdLo == null || wdHi == null ||
      timeLo == null || timeHi == null
    ) continue;
    const uLo = -wsLo * Math.sin(wdLo * Math.PI / 180);
    const vLo = -wsLo * Math.cos(wdLo * Math.PI / 180);
    const uHi = -wsHi * Math.sin(wdHi * Math.PI / 180);
    const vHi = -wsHi * Math.cos(wdHi * Math.PI / 180);
    for (let j = lo + 1; j < hi; j++) {
      const t = timeHi !== timeLo
        ? (downsampled[j].time - timeLo) / (timeHi - timeLo)
        : (j - lo) / (hi - lo);
      downsampled[j].temp          = tLo  + (tHi  - tLo)  * t;
      downsampled[j].precipProb    = ppLo + (ppHi - ppLo) * t;
      downsampled[j].precipitation = pLo  + (pHi  - pLo)  * t;
      const u = uLo + (uHi - uLo) * t;
      const v = vLo + (vHi - vLo) * t;
      downsampled[j].windSpeed     = Math.sqrt(u * u + v * v);
      downsampled[j].windDeg       = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
      downsampled[j].time          = timeLo + (timeHi - timeLo) * t;
    }
  }
```

- [ ] **Step 2: Run the hook's tests**

```bash
npx vitest run src/hooks/useWeatherChartData.test.ts
```

Expected: all 7 tests pass (4 original updated + 3 new).

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass, no regressions.

---

### Task 3: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add src/hooks/useWeatherChartData.ts \
        src/hooks/useWeatherChartData.test.ts \
        docs/superpowers/specs/2026-06-10-wind-interpolation-accuracy-design.md \
        docs/superpowers/plans/2026-06-11-wind-uv-interpolation.md
git commit -m "fix(weather): u/v vector wind interpolation and time-based t factor

Replace scalar windSpeed/windDeg interpolation with meteorological u/v
decomposition: fixes circular wrapping across the 0/360 boundary and
gives physically correct speed magnitudes through direction changes.
Switch interpolation factor t from index-based to time-based for
correctness with piecewise-speed routes."
```
