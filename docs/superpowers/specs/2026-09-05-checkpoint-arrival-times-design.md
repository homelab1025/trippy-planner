# Checkpoint Arrival Times — Design Spec

**Date:** 2026-09-05
**Issue:** #38 — "Average speed is not reflecting reality for calculation of the timeline."

## Context

The app currently models an entire ride at one constant average speed (`avgSpeed` state in `App.tsx`): every weather sample point's arrival time is `startTime + distance / (avgSpeed * 1000)` hours, computed inline in `updateWeather` (`App.tsx:190-191`) and again in `buildChartData` (`frontend/src/hooks/useWeatherChartData.ts:56`). Issue #38 discusses several UX proposals; the thread converges on a **Hybrid A+B** design (checkpoints with user-set arrival times, deferring gradient-based intra-segment shaping to a follow-up — see the issue's gap #2 resolution). A clickable HTML mock (`frontend/checkpoint-cascade-mock.html`, not part of the app bundle) was built and iterated on to nail down the exact interaction model; this spec ports that mock's behavior into the real app and adds server-side persistence.

Scope is deliberately narrower than the issue's full "Hybrid A+B" comment: **no gradient model** (Proposal A) is implemented. Segment speed is constant between checkpoints — the same simplification the mock used and the issue explicitly allows as a first iteration.

## Design

### 1. `frontend/src/utils/speedProfile.ts` (new)

```ts
export interface Checkpoint {
  id: string;
  distanceM: number;
  arrivalTime: Date;
  pinned: boolean;
}
```

The **start** of the route is never stored as a `Checkpoint` — it's synthesized from the existing `startTime` state wherever needed, avoiding a second source of truth that could drift from the `Start Time` sidebar field. `checkpoints` arrays therefore hold only user-added waypoints plus one mandatory **end** entry pinned to `distanceM = route.totalDistance`. This mirrors the mock's invariant that a checkpoint always exists at the end of the course (fixed distance, undeletable, but its time is editable).

`pinned` distinguishes "still auto-tracking Average Speed" (`false`) from "user set this time explicitly, detached from Average Speed" (`true`). Only `end` is ever created with `pinned: false`; every waypoint is `pinned: true` from creation (the mock always asks for a time when adding one).

Exported functions:
- `buildSequence(startTime: Date, checkpoints: Checkpoint[]): { distanceM: number; arrivalTime: Date }[]` — prepends the synthesized start, sorts by `distanceM`, returns the full ordered sequence (including `end`).
- `computeArrivalTime(distanceM: number, startTime: Date, checkpoints: Checkpoint[]): Date` — finds the bracketing pair in `buildSequence` and linearly interpolates by distance fraction. Clamps to the sequence's first/last time outside `[0, totalDistance]`. This is the single function that replaces every inline `distance / (speed * 1000)` arrival-time formula in the app.
- `impliedSpeedKmh(a: { distanceM; arrivalTime }, b: { distanceM; arrivalTime }): number | null` — `(b.distanceM - a.distanceM) / 1000 / hoursBetween`; `null` if `hoursBetween <= 0` (used for display only, e.g. "— km/h" when a user picks a non-increasing time before validation catches it).
- `defaultCheckpoints(totalDistanceM: number, avgSpeedKmh: number, startTime: Date): Checkpoint[]` — returns `[{ id: 'end', distanceM: totalDistanceM, arrivalTime: computed from avgSpeed, pinned: false }]`, used whenever a route has no stored checkpoints.

### 2. Auto-track vs. pinned (App.tsx)

```ts
React.useEffect(() => {
  setCheckpoints(cps => cps.map(cp =>
    cp.pinned ? cp : { ...cp, arrivalTime: new Date(startTime.getTime() + cp.distanceM / (avgSpeed * 1000) * 3_600_000) }
  ));
}, [avgSpeed, startTime]);
```

In practice this only ever touches `end` before its first manual edit, since waypoints are always pinned. Right-click → "Change time" on any checkpoint sets `pinned: true` as part of the same update (matches the mock).

### 3. Chart UI

**`frontend/src/components/CheckpointOverlay.tsx`** (new) — purely decorative, rendered inside `ElevationChart`'s `<ComposedChart>` next to `<ClimbOverlay>` (`ElevationChart.tsx:114`). Uses the same `useXAxisScale`/`useYAxisScale('elevation')`/`usePlotArea` hooks `ClimbOverlay.tsx` already uses (`ClimbOverlay.tsx:41-43`) to place a small circle at each checkpoint's `(distance, interpolated elevation)` plus a dashed vertical guide down to the plot's bottom edge — the same visual as the mock's curve dots. No event handlers here; all interaction lives in the track row below (this was the source of the "last checkpoint isn't clickable" bug in the mock — keeping *one* interactive surface avoids repeating it).

**`frontend/src/components/CheckpointTrackRow.tsx`** (new) — an interactive row inserted between the elevation chart and `WindArrowRow` (`App.tsx:760-768`), built like `WindArrowRow.tsx`/`PrecipBarRow.tsx`: same `PLOT_LEFT`/`PLOT_RIGHT_OFFSET` constants and `xOf(distance)` pixel mapping (`WindArrowRow.tsx:14-23`), rather than hooking into Recharts' internals — dragging needs raw `mousemove` tracking that doesn't fit Recharts' hover-index model. Props:

```ts
interface Props {
  checkpoints: Checkpoint[];
  startTime: Date;
  totalDistanceM: number;
  distanceRange: [number, number];
  chartWidth: number;
  onChange: (next: Checkpoint[]) => void;
}
```

Ports the mock's three interactions as a controlled component (all mutations go through `onChange`, no local copy of the array):
- **Click empty track** → `ConfirmDialog` ("Add checkpoint here?") → on confirm, `CheckpointTimeEditor` popover pre-filled via `computeArrivalTime` at that distance → on save, inserts a new pinned waypoint.
- **Drag** an existing waypoint (not `end`) → live-updates `distanceM` only, clamped between neighbors; time unchanged (already pinned).
- **Right-click** → small context menu ("Change time" / "Delete checkpoint" — delete hidden for `end`, matching the mock's `cpMenuDelete` visibility toggle). "Change time" opens `CheckpointTimeEditor`; if downstream checkpoints exist and the time actually changed, a small cascade popover offers **Shift times** (add the same delta to every downstream checkpoint) or **Keep times** (leave them, let the following segment's speed recompute) — ports the mock's `cascadeShift`/`cascadeKeep` logic exactly.

**`frontend/src/components/CheckpointTimeEditor.tsx`** (new) — the shared add/change-time popover (time `<input>` + Save/Cancel + inline validation error), extracted since both flows need it. The "Add checkpoint here?" step reuses the existing `ConfirmDialog.tsx` as-is. The cascade shift-vs-keep choice does not fit `ConfirmDialog`'s Cancel/OK shape (two non-destructive alternatives, not a confirm/cancel) — it's a small purpose-built popover local to `CheckpointTrackRow.tsx`.

**`frontend/src/theme/chartColors.ts`**: add `checkpointWaypoint`, `checkpointLocked`, `checkpointGuide`, `checkpointRecomputed` entries (colors ported from the mock: `#1b6ec2` waypoint blue, `#256a4e` locked green — reusing the existing brand green rather than inventing a new one, `#9aa4a0` guide gray, `#c0392b` recomputed red).

### 4. Sidebar panel

A new "Checkpoints" collapse section in `App.tsx`, inserted immediately after "Ride Details" (`App.tsx:540`), following the same `collapse collapse-arrow` + `activePanel` single-open-accordion pattern as the existing panels (`App.tsx:460-467`). Lists each checkpoint (distance, time, implied segment speed via `impliedSpeedKmh`), read-only — all editing happens on the chart, matching the mock.

### 5. `App.tsx` wiring

- New state: `const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);`
- `isDirty` (`App.tsx:166-171`) gains a checkpoints comparison: `JSON.stringify(lastFetchedParams.checkpoints) !== JSON.stringify(checkpoints)` — string comparison matches the "store as opaque JSON" treatment used everywhere else for this data, and avoids writing a structural-equality helper for a small array.
- `handleFileUpload` (`App.tsx:136-164`): a genuinely new GPX means old checkpoint distances are meaningless (issue's gap #5) — reset via `setCheckpoints(defaultCheckpoints(parsedRoute.totalDistance, avgSpeed, startTime))` right after `setRoute`.
- `loadRouteFromGpxText` (`App.tsx:213-225`) gains a `checkpoints?: Checkpoint[]` param: saved/shared routes restore their own (parsed from `checkpointsJson`); a route with no stored checkpoints (older data, column is `NULL`) falls back to `defaultCheckpoints`. Callers: the share-link effect (`App.tsx:318-333`), the localStorage mount effect (`App.tsx:334-350`), and `MyRoutesPanel`'s `onLoadRoute` (`App.tsx:585-592`) all thread the parsed value through.
- `updateWeather` (`App.tsx:173-211`): drop the `speed: number` param, add `checkpoints: Checkpoint[]`; replace the inline `travelTimeHours`/`arrivalTime` calculation (`App.tsx:190-191`) with `computeArrivalTime(distance, start, checkpoints)`. `lastFetchedParams` gains a `checkpoints` field alongside `avgSpeed`/`startTime`/`selectedProvider`, following the same "value in effect when weather was last fetched" pattern already used for the dirty flag and chart interpolation lag.
- `useWeatherChartData.ts`: `buildChartData`'s per-point `time` field (`useWeatherChartData.ts:56`) and the `modeledTimeAt` helper (`useWeatherChartData.ts:89-90`) both swap `avgSpeed`/`weatherAvgSpeed` for `computeArrivalTime(distance, startTime/weatherStartTime, checkpoints/weatherCheckpoints)` — same lag-until-Refresh pattern, now driven by checkpoints instead of a flat speed.
- `routeStorage.ts`: `StoredRoute` gains `checkpointsJson?: string`; the mirror effect (`App.tsx:356-368`) and the mount-time restore (`App.tsx:334-350`) read/write it via `JSON.stringify`/`JSON.parse` of the `Checkpoint[]` array (dates serialized as ISO strings, matching `startTime`'s existing treatment).
- `SaveRouteButton.tsx`: `routeData` gains `checkpointsJson: JSON.stringify(checkpoints)` passed from `App.tsx` alongside the existing `gpxContent`/`avgSpeedKmh`/`startTime` (`App.tsx:550-554`). Update also sends it (currently `updateRoute` only sends `name`/`avgSpeedKmh`/`startTime` — `SaveRouteButton.tsx:27-31` — extend to include it, since editing checkpoints on an already-saved route should be persisted by the same "Save" button, not just at creation time).
- `MyRoutesPanel.tsx`: `handleClick`/`handleDuplicate` already call `routesApi.getRoute(id)` for the full `Route` (which will now include `checkpointsJson`); thread it through `onLoadRoute`'s new parameter and into `createRoute` for duplication.

### 6. Backend persistence

- New migration `backend/src/main/resources/db/migration/V5__add_route_checkpoints.sql`:
  ```sql
  ALTER TABLE routes ADD COLUMN checkpoints_json TEXT;
  ```
  Nullable, no default — `NULL` means "no stored checkpoints," handled entirely client-side by falling back to `defaultCheckpoints`. No backend validation of the JSON content (opaque blob, same treatment as `gpx_content`).
- `openapi.yaml`: add `checkpointsJson: { type: string }` (not in `required`, following the same optionality convention `UpdateRouteRequest`'s fields already use — `openapi.yaml:82-92`) to `Route`, `CreateRouteRequest`, and `UpdateRouteRequest`. **Not** added to `RouteListItem`, matching `gpxContent`'s exclusion from the list view (`openapi.yaml:37-65`).
- `RouteRepository.java`: `FULL_MAPPER` reads `checkpoints_json` into `Route.checkpointsJson`; `save()`'s `INSERT` includes it; `update()`'s dynamic `SET` builder (`RouteRepository.java:74-85`) adds a branch for it, same pattern as the existing `name`/`avgSpeedKmh`/`startTime` branches.
- `RoutesController.java` and `ShareController.java` need no changes — both already pass the full generated `Route`/`CreateRouteRequest`/`UpdateRouteRequest` objects through, so the new field flows automatically once the OpenAPI-generated model includes it.
- `make generate` (or `./mvnw generate-sources` + `npm run generate:api`) regenerates the Spring model/interfaces and the TS Axios client from the updated `openapi.yaml`.

### 7. Interaction with weather sampling

Weather sample points are chosen purely by **distance** (`updateWeather`, `App.tsx:174-179`: roughly every 5 km, floor of 11 points on short routes) — this is a function of `route.totalDistance` only, which checkpoints never change. So **checkpoints do not change which points are sampled or how many**; that grid is identical before and after this feature.

What changes is the **arrival time assigned to each already-existing sample point**: `computeArrivalTime(distance, ...)` replaces the flat `distance / (avgSpeed * 1000)` formula, so the same physical point can now resolve to a different hourly forecast than the constant-speed model would have picked. That's the intended effect of the feature.

One consequence worth naming explicitly: if checkpoint edits stretch total ride duration enough (long slow segments, or a start date already near the 7-day forecast horizon), a late-route point's computed arrival time can fall outside Open-Meteo's forecast window. This is not a new failure mode — the existing "out-of-range lookup returns `null` per point, UI shows unavailable" behavior (see CLAUDE.md's weather-fetching notes) already covers it — but it becomes easier to trigger than under the constant-speed model, since a user can now deliberately create long slow stretches. No new handling is needed; flagging it so it isn't mistaken for a bug during review.

Injecting extra sample points exactly at checkpoint distances (so a checkpoint always gets a real, non-interpolated fetch) is the issue's gap #3 and remains out of scope here — see below.

## Testing

- `frontend/src/utils/speedProfile.test.ts` (new): `computeArrivalTime` before the start, after `end`, between two waypoints, and with only `end` present (must equal today's constant-speed formula exactly — regression guard); `defaultCheckpoints` shape; the auto-track effect's pinned-vs-unpinned recompute logic (can be tested as a pure reducer-style function extracted for testability, or via an `App.tsx` integration test if simpler at implementation time).
- `backend/.../RouteRepositoryTest.java`: extend with a `checkpoints_json` round-trip (save with a JSON string, retrieve, assert equality) and a null-column case (save without it, assert the field is `null` on read).
- `backend/.../RoutesControllerTest.java`: extend one existing create/update case to assert `checkpointsJson` passes through the mock repository call.
- `frontend/tests/local-route-persistence.spec.ts` (Playwright, extend): add a checkpoint via the track row, reload the page, assert it's still there (localStorage round-trip) — mirrors this file's existing pattern of reload-and-assert for other route fields.
- A new or extended save/load Playwright spec: save a route with a checkpoint, reload it via `MyRoutesPanel`, assert the checkpoint is present — covers the backend round-trip end-to-end.
- Pixel-precise drag interaction is not covered by Playwright (fragile, as noted when verifying the mock) — click-to-add and right-click-menu flows are, since those are precise/deterministic.

## Out of scope

- The gradient model (Proposal A) and rider-profile presets (Proposal D) from the issue thread.
- Intra-segment gradient shaping within a pinned segment (issue's gap #2) — constant segment speed only, as the issue itself allows for a first iteration.
- Weather-sample-point injection at exact checkpoint distances (issue's gap #3) — sample points remain evenly spaced; checkpoints only change *arrival time* math, not *where* weather is sampled. Worth a follow-up issue.
- Mobile drag ergonomics (issue's gap #6) — explicitly deferred by the issue itself.
- Moving `checkpoints_json` to its own table — explicitly out of scope per this task's instructions.
