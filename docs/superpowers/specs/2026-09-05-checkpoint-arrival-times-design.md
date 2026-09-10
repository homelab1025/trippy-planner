# Checkpoint Arrival Times — Design Spec

**Date:** 2026-09-05
**Updated:** 2026-09-10 — revised to match the shipped implementation; see [ADR](../../adr/2026-09-10-checkpoint-arrival-time-model.md) and [FDR](../../fdr/2026-09-10-checkpoint-arrival-times.md) for the decisions made along the way.
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
- `parseCheckpointsJson(json: string): Checkpoint[] | undefined` — revives a persisted `checkpoints_json` payload (localStorage mirror, saved route, share link). Deliberately returns `undefined`, never `[]`, for anything unusable (parse failure, empty array, all-invalid dates), so that callers' `?? defaultCheckpoints(...)` fallback actually engages — an empty array would satisfy `??` and silently leave the route with no `end` checkpoint, breaking the invariant that one always exists. Used by the share-link effect, the localStorage mount effect, and `MyRoutesPanel`'s `onLoadRoute` in section 5.

### 2. Auto-track vs. pinned (App.tsx)

Implemented as a derived value rather than an effect (`4c2bca6`, refactored from an initial effect-based version to avoid the extra render/commit an effect causes): `effectiveCheckpoints` is a `useMemo` over `[checkpoints, avgSpeed, startTime]` that maps every unpinned checkpoint to a live-recomputed `arrivalTime` (`startTime + distanceM / (avgSpeed * 1000)` hours) and passes pinned ones through unchanged. `checkpoints` state holds the raw, possibly-stale array; `effectiveCheckpoints` is the value actually consumed everywhere else in the app — chart, sidebar, weather calculation, the localStorage mirror, and Save (see section 5).

In practice the live recompute only ever touches `end` before its first manual edit, since waypoints are always pinned. Right-click → "Change time" on any checkpoint sets `pinned: true` as part of the same update (matches the mock).

**Shifting pinned checkpoints on Start Date/Time change:** added after the initial implementation (`f500cee`) — pinned checkpoints hold an absolute `arrivalTime`, so unlike unpinned ones they don't move when `startTime` changes. Editing Start Date or Start Time in the Route details panel now also calls `shiftPinnedCheckpoints(deltaMs)`, which shifts every pinned checkpoint's `arrivalTime` by the same delta applied to `startTime`, so the gap between pinned checkpoints and the rest of the route stays unchanged instead of silently drifting.

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
  elevationData?: ElevationSample[]; // terrain-colored segments, see below
  hoveredDistance?: number | null;   // hover-crosshair sync, see below
  onHoverIndex?: (index: number | null) => void;
}
```

Ports the mock's three interactions as a controlled component (all mutations go through `onChange`, no local copy of the array):
- **Click empty track** → `ConfirmDialog` ("Add checkpoint here?") → on confirm, `CheckpointTimeEditor` popover pre-filled via `computeArrivalTime` at that distance → on save, inserts a new pinned waypoint.
- **Drag** an existing waypoint (not `end`) → clamped between neighbors; time unchanged (already pinned). Implemented as a local `dragPreviewKm` state rather than a live `onChange` per mousemove: updates are rAF-throttled per frame (`55dc1ad`) and held entirely in local state until mouse-up, when the final position is committed once via `onChange` (`3f7d911`, `ac6f9ca`). This is user-visible — the map, sidebar list, and localStorage mirror only reflect the new position after the drag ends, not during it.
- **Right-click** → small context menu ("Change time" / "Delete checkpoint" — delete hidden for `end`, matching the mock's `cpMenuDelete` visibility toggle). "Change time" opens `CheckpointTimeEditor` with no upper time bound (`af5c2d1` removed the original cap at the next checkpoint's time — editing past it is now allowed). If downstream checkpoints exist and the time actually changed, a cascade popover offers **Shift times** (add the same delta to every downstream checkpoint) or **Keep times** (leave them, let the following segment's speed recompute) — ports the mock's `cascadeShift`/`cascadeKeep` logic, extended with a `keepDisabled` case: "Keep times" is disabled whenever the new time would be at or past the immediate next checkpoint's (pre-edit) time, since keeping would reorder checkpoints — only Shift stays valid then.

**Terrain-colored segments** (not in the original design): each gap between adjacent checkpoints in the track row is rendered as a colored bar — climb, descent, or flat, classified via `terrainAt`/`elevationAtKm` against the route's elevation profile — labeled with the segment's rounded implied speed. This requires `CheckpointTrackRow` to also receive the route's `elevationData` as a prop.

**Hover-crosshair sync** (`1c30e93`, not in the original design): `CheckpointTrackRow` gained `hoveredDistance`/`onHoverIndex` props. Hovering the track row drives the shared crosshair across the elevation chart and the other rows (via `nearestIndex`), and the row renders its own crosshair line when the hover originates elsewhere (e.g. the elevation chart) — keeping checkpoint position and hovered chart position visually in sync.

**`frontend/src/components/CheckpointTimeEditor.tsx`** (new) — the shared add/change-time popover (time `<input>` + Save/Cancel + inline validation error), extracted since both flows need it. The "Add checkpoint here?" step reuses the existing `ConfirmDialog.tsx` as-is. The cascade shift-vs-keep choice does not fit `ConfirmDialog`'s Cancel/OK shape (two non-destructive alternatives, not a confirm/cancel) — it's a small purpose-built popover local to `CheckpointTrackRow.tsx`.

**`frontend/src/theme/chartColors.ts`**: add `checkpointWaypoint`, `checkpointLocked`, `checkpointGuide` entries (colors ported from the mock: `#1b6ec2` waypoint blue, `#256a4e` locked green — reusing the existing brand green rather than inventing a new one, `#9aa4a0` guide gray). The originally-planned `checkpointRecomputed` (`#c0392b` red) was never implemented — no UI state ended up needing it. Implementation also added `segmentClimbBg/Text`, `segmentDescentBg/Text`, `segmentFlatBg/Text` (sourced from `checkpoint-cascade-mock.html`'s `.seg-climb`/`.seg-desc`/`.seg-flat` classes) to back the terrain-colored segments described below, not anticipated in the original design.

### 4. Sidebar panel

A new "Checkpoints" collapse section in `App.tsx`, inserted immediately after "Ride Details", following the same `collapse collapse-arrow` + `activePanel` single-open-accordion pattern as the existing panels. Only rendered once a route is loaded. Lists each checkpoint (distance, time, implied segment speed via `buildSequence`/`impliedSpeedKmh`), read-only — all editing happens on the chart, matching the mock. Rows are labeled "Start" / "CP n" / "Finish".

### 5. `App.tsx` wiring

- New state: `const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);`, plus the `effectiveCheckpoints` derived value from section 2 that every consumer below actually reads.
- `isDirty` gains a checkpoints comparison against `effectiveCheckpoints`, not the raw `checkpoints` state: `JSON.stringify(lastFetchedParams.checkpoints) !== JSON.stringify(effectiveCheckpoints)` — string comparison matches the "store as opaque JSON" treatment used everywhere else for this data, and avoids writing a structural-equality helper for a small array.
- `handleFileUpload`: a genuinely new GPX means old checkpoint distances are meaningless (issue's gap #5) — reset via `setCheckpoints(defaultCheckpoints(parsedRoute.totalDistance, avgSpeed, startTime))` right after `setRoute`.
- `loadRouteFromGpxText` gains a `checkpoints?: Checkpoint[]` param: saved/shared routes restore their own (parsed from `checkpointsJson` via `parseCheckpointsJson`); a route with no stored checkpoints (older data, column is `NULL`, or an unparseable/empty payload) falls back to `defaultCheckpoints`. Callers: the share-link effect, the localStorage mount effect, and `MyRoutesPanel`'s `onLoadRoute` all thread the parsed value through.
- `updateWeather`: drop the `speed: number` param, add `checkpoints: Checkpoint[]`; replace the inline `travelTimeHours`/`arrivalTime` calculation with `computeArrivalTime(distance, start, checkpoints)`. `lastFetchedParams` gains a `checkpoints` field alongside `avgSpeed`/`startTime`/`selectedProvider`, following the same "value in effect when weather was last fetched" pattern already used for the dirty flag and chart interpolation lag.
- `useWeatherChartData.ts`: `buildChartData`'s per-point `time` field and the `modeledTimeAt` helper both swap `avgSpeed`/`weatherAvgSpeed` for `computeArrivalTime(distance, startTime/weatherStartTime, checkpoints/weatherCheckpoints)` — same lag-until-Refresh pattern, now driven by checkpoints instead of a flat speed.
- `routeStorage.ts`: `StoredRoute` gains `checkpointsJson?: string`; the mirror effect and the mount-time restore read/write it via `JSON.stringify`/`parseCheckpointsJson` of `effectiveCheckpoints` (not raw `checkpoints` — persisting an unpinned entry's stale, non-live-recomputed time would go stale relative to the `avgSpeed`/`startTime` stored beside it), dates serialized as ISO strings matching `startTime`'s existing treatment.
- `SaveRouteButton.tsx`: `routeData` gains `checkpointsJson: JSON.stringify(effectiveCheckpoints)` passed from `App.tsx` alongside the existing `gpxContent`/`avgSpeedKmh`/`startTime`. Update also sends it (`updateRoute` previously only sent `name`/`avgSpeedKmh`/`startTime` — extended to include it, since editing checkpoints on an already-saved route should be persisted by the same "Save" button, not just at creation time).
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

- `frontend/src/utils/speedProfile.test.ts` (new): `computeArrivalTime` before the start, after `end`, between two waypoints, and with only `end` present (must equal today's constant-speed formula exactly — regression guard); `defaultCheckpoints` shape; `parseCheckpointsJson`'s undefined-not-empty-array fallback behavior (not anticipated in the original plan).
- The auto-track/pinned-shift recompute logic landed as `App.tsx` integration tests rather than a standalone reducer test (the plan allowed either) — see `App.test.tsx`'s `'mirrors auto-tracked checkpoint times to localStorage after an avg speed change'` and `'shifts a pinned checkpoint's time by the same delta as a Start Time change, keeping the gap unchanged'`.
- `backend/.../RouteRepositoryTest.java`: extended with a `checkpoints_json` round-trip (save with a JSON string, retrieve, assert equality) and a null-column case (save without it, assert the field is `null` on read), as planned.
- `backend/.../RoutesControllerTest.java`: extended with `createRoutePassesThroughCheckpointsJson`, covering the create path only — the update path isn't separately asserted here.
- `frontend/tests/local-route-persistence.spec.ts` (Playwright, extended): add a checkpoint via the track row, reload the page, assert it's still there (localStorage round-trip).
- `frontend/tests/my-routes.spec.ts` (Playwright, extended): `'a saved route's checkpoints are restored when reloaded from My Routes'` — covers the backend round-trip end-to-end.
- Pixel-precise drag interaction is not covered by Playwright (fragile, as noted when verifying the mock) — click-to-add and right-click-menu flows are, since those are precise/deterministic.
- Two whole test files not anticipated in the original plan, added as the UI grew beyond the initial design: `CheckpointTrackRow.test.tsx` (drag/rAF-throttling behavior, past-next-checkpoint cascade and `keepDisabled`, terrain classification, hover-crosshair sync, segment speed labels) and `CheckpointTimeEditor.test.tsx`.

## Out of scope

- The gradient model (Proposal A) and rider-profile presets (Proposal D) from the issue thread.
- Intra-segment gradient shaping within a pinned segment (issue's gap #2) — constant segment speed only, as the issue itself allows for a first iteration.
- Weather-sample-point injection at exact checkpoint distances (issue's gap #3) — sample points remain evenly spaced; checkpoints only change *arrival time* math, not *where* weather is sampled. Worth a follow-up issue.
- Mobile drag ergonomics (issue's gap #6) — explicitly deferred by the issue itself.
- Moving `checkpoints_json` to its own table — explicitly out of scope per this task's instructions.
