# Wind Interpolation Accuracy Design

**Date:** 2026-06-10
**Status:** Approved

## Problem

Wind values displayed on the timeline between the 11 weather sample points are interpolated, not fetched. Two correctness bugs exist in the current interpolation, and a structural problem limits accuracy over varied terrain.

### Bug 1 — Circular angle wrapping and independent speed interpolation (`useWeatherChartData.ts:98-99`)

Wind direction and speed are both interpolated as plain scalars:

```ts
downsampled[j].windSpeed = wsLo + (wsHi - wsLo) * t;
downsampled[j].windDeg   = wdLo + (wdHi - wdLo) * t;
```

Two problems:
1. **Circular wrapping**: wind degrees are circular (0–360°). Interpolating between 350° and 10° yields 180° (dead south) when the correct result is 0° (north).
2. **Independent speed interpolation**: interpolating speed separately from direction gives physically wrong magnitudes at the midpoint of a direction change. E.g., 30 km/h NW → 30 km/h NE yields 30 km/h north at the midpoint, but the correct vector average is ~21 km/h north.

The fix is to decompose each endpoint into Cartesian (u, v) components, interpolate those, then reconstruct:

```ts
// outside j-loop (once per sample pair)
const uLo = -wsLo * Math.sin(wdLo * Math.PI / 180);
const vLo = -wsLo * Math.cos(wdLo * Math.PI / 180);
const uHi = -wsHi * Math.sin(wdHi * Math.PI / 180);
const vHi = -wsHi * Math.cos(wdHi * Math.PI / 180);

// inside j-loop
const u = uLo + (uHi - uLo) * t;
const v = vLo + (vHi - vLo) * t;
downsampled[j].windSpeed = Math.sqrt(u * u + v * v);
downsampled[j].windDeg   = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
```

This is the meteorological standard convention (`-u`, `-v` in `atan2` because direction is *from*, not *toward*). Circular wrapping is handled implicitly — no modular arithmetic needed.

### Bug 2 — Index-based interpolation parameter vs. time-based

The interpolation factor `t` is computed as a fraction of chart array indices:

```ts
const t = (j - lo) / (hi - lo);  // useWeatherChartData.ts:94
```

After LTTB downsampling, the chart array is roughly distance-uniform, so `t` approximates a distance fraction between two samples. But weather is time-based — what matters is at what *time* the rider is at a given point, not what fraction of the distance they've covered. At constant speed these are equivalent, but with waypoint pins (piecewise speeds) they diverge. Segment A might take 2 hours, segment B 30 minutes; interpolating by distance position gives wrong weather for the fast segment.

The fix: interpolate using the `time` values already on each `ChartDataPoint`:

```ts
const t = (downsampled[j].time - timeLo) / (timeHi - timeLo);
```

Since `time` at non-sample points is already computed from the speed model (constant speed or pins), this makes weather interpolation consistent with arrival time.

### Structural problem — 11 samples and terrain

The app fetches exactly 11 evenly-spaced points. For a 150 km route, samples are ~15 km apart. A mountain pass, valley wind funnel, or coastal transition may sit entirely between two samples and be invisible in the interpolated curve. Linear interpolation between samples 6 km either side of a 2000m col will show steady wind when the actual ridge is 50% faster.

This is harder to fix without a larger API footprint or a different sampling strategy. Two options:

**Option A — Increase sample count.** Open-Meteo supports up to 50 simultaneous points in one batch call. Raising to 25+ reduces maximum gap to ~6 km on a 150 km ride. Cost: one API call, no code structure changes. Downside: diminishing returns without smarter placement.

**Option B — Elevation-aware sampling.** Sample more densely around large elevation changes (cols, descents). Use the existing `climbDetector.ts` output to insert extra samples at climb summits. Cost: moderate complexity in the point-selection logic; still linear interpolation between samples.

**Option C — Accept the limitation.** The app already fetches real weather at 11 geographic coordinates with correct arrival times. Linear interpolation between them is an acknowledged approximation. The hover pane shows wind values that came from real samples at the orange dots — users who care about a specific terrain feature can check it by hovering near the dots. No structural change needed; only fix bugs 1 and 2.

---

## Goals

1. Fix wind interpolation via u/v decomposition (Bug 1) — fixes both circular wrapping and independent speed interpolation.
2. Fix the time-based interpolation parameter (Bug 2) — important for correctness with pins.
3. Decide whether to address the sample density structural problem and if so, which option.

## Non-goals

- Fetching sub-hourly weather data (Open-Meteo is hourly).
- Terrain wind modelling (would require a dedicated API like Tomorrow.io).

---

## Design

### Phase 1 — Bug fixes (always do this)

Only `src/hooks/useWeatherChartData.ts` changes.

**u/v wind fix (lines 84-99):**

Outside the `j`-loop, decompose both sample endpoints into Cartesian components:

```ts
const uLo = -wsLo * Math.sin(wdLo * Math.PI / 180);
const vLo = -wsLo * Math.cos(wdLo * Math.PI / 180);
const uHi = -wsHi * Math.sin(wdHi * Math.PI / 180);
const vHi = -wsHi * Math.cos(wdHi * Math.PI / 180);
```

Inside the `j`-loop, replace the two scalar wind lines with component interpolation and reconstruction:

```ts
const u = uLo + (uHi - uLo) * t;
const v = vLo + (vHi - vLo) * t;
downsampled[j].windSpeed = Math.sqrt(u * u + v * v);
downsampled[j].windDeg   = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
```

This replaces both the `windSpeed` line (:98) and `windDeg` line (:99). Speed no longer has an independent interpolation.

**Time-based `t` (line 94):**

```ts
const t = timeHi !== timeLo
  ? (downsampled[j].time - timeLo) / (timeHi - timeLo)
  : (j - lo) / (hi - lo);
```

`downsampled[j].time` is already populated from the speed model before interpolation runs, so this is a two-line change with no new state.

**Guard:** if `timeHi === timeLo` (zero-duration segment — impossible in practice but safe to guard), fall back to index-based `t`.

### Phase 2 — Sample density (optional, choose an option)

If Option A is chosen: change the sample count constant from `11` to `25` in the weather-fetching logic in `App.tsx`. The batch call structure is unchanged; Open-Meteo handles multi-point batches already.

If Option B is chosen: a new `samplePoints(route, climbs, targetCount)` function in a new utility replaces the current evenly-spaced logic. Out of scope for this spec revision.

If Option C: no additional code.

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useWeatherChartData.ts` | u/v vector wind interpolation; switch `t` to time-based |
| `src/App.tsx` | (Phase 2 only, Option A) increase sample count constant |

---

## Open Questions

1. **Sample density decision**: Option A, B, or C? Option C is the honest minimum; Option A is low-risk. Option B is the most accurate but adds complexity before the terrain wind model becomes the bottleneck anyway.
2. **Visible indicator**: Should non-sample interpolated wind values be visually distinguished (e.g., lower opacity arrow) to signal "estimated, not fetched"? Currently there's no UI distinction.
