# Checkpoint Arrival Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user pin arrival times at points along their route (checkpoints), have the app derive per-segment speed from them, and use that for weather-timing math instead of one constant average speed — persisting checkpoints with the saved route.

**Architecture:** A pure `speedProfile.ts` utility replaces every inline `distance/(avgSpeed*1000)` arrival-time formula with `computeArrivalTime()` driven by a `Checkpoint[]` array (always ending with a mandatory, undeletable "end" checkpoint). Two new chart components — a decorative in-chart overlay and an interactive track row below the chart — port the previously-approved `frontend/checkpoint-cascade-mock.html` prototype's add/drag/right-click interactions into the real app as controlled React components. Checkpoints are persisted alongside the route: `checkpoints_json` TEXT column on the backend, mirrored to `localStorage` client-side, same opaque-JSON treatment as no other field currently gets (closest precedent is `gpx_content`, which is also an opaque blob column).

**Tech Stack:** React 18 + TypeScript + Vite (frontend), Spring Boot + JdbcTemplate + Flyway (backend), Recharts (charts), Vitest + Testing Library (frontend unit tests), JUnit 5 + Testcontainers (backend tests), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-09-05-checkpoint-arrival-times-design.md`

## Global Constraints

- No gradient model, rider profiles, or intra-segment speed shaping — constant speed per segment only (spec's "Out of scope").
- Weather sample points stay purely distance-based — checkpoints never change which points are sampled, only their computed arrival time (spec section 7).
- `checkpoints_json` is an opaque TEXT blob server-side — no backend JSON validation, same treatment as `gpx_content`.
- `RouteListItem` never gains `checkpointsJson` — same exclusion as `gpxContent` (list view stays lightweight).
- Every task must leave `./mvnw test` (backend tasks) or `npx vitest run` (frontend tasks) green before moving to the next task.
- Follow `contributing/styleguide/` conventions for whichever language a task touches.

---

## Task 1: OpenAPI contract — add `checkpointsJson`

**Files:**
- Modify: `openapi.yaml`

**Interfaces:**
- Produces: `checkpointsJson?: string` on the generated `Route`, `CreateRouteRequest`, `UpdateRouteRequest` TS types and Java model classes (`com.trippyplanner.model.Route`, `.CreateRouteRequest`, `.UpdateRouteRequest`), each gaining `getCheckpointsJson()`/`setCheckpointsJson(String)`.

- [ ] **Step 1: Add the field to the three schemas**

In `openapi.yaml`, add `checkpointsJson` to `Route` (inside the `allOf` object's `properties`, next to `gpxContent`):

```yaml
    Route:
      allOf:
        - $ref: '#/components/schemas/RouteListItem'
        - type: object
          required: [gpxContent]
          properties:
            gpxContent:
              type: string
            checkpointsJson:
              type: string
```

Add it to `CreateRouteRequest`'s `properties` (not `required`):

```yaml
    CreateRouteRequest:
      type: object
      required: [name, gpxContent, avgSpeedKmh, startTime]
      properties:
        name:
          type: string
        gpxContent:
          type: string
        avgSpeedKmh:
          type: number
          format: double
        startTime:
          type: string
          format: date-time
        checkpointsJson:
          type: string
```

Add it to `UpdateRouteRequest`'s `properties`:

```yaml
    UpdateRouteRequest:
      type: object
      properties:
        name:
          type: string
        avgSpeedKmh:
          type: number
          format: double
        startTime:
          type: string
          format: date-time
        checkpointsJson:
          type: string
```

Do **not** add it to `RouteListItem`.

- [ ] **Step 2: Regenerate both clients and verify**

```bash
cd /workspace && make generate
```

Expected: no errors. Then verify the field landed:

```bash
grep -n "checkpointsJson" backend/target/generated-sources/openapi/src/main/java/com/trippyplanner/model/Route.java
grep -n "checkpointsJson" frontend/src/api/api.ts
```

Both should show matches.

- [ ] **Step 3: Commit**

```bash
git add openapi.yaml
git commit -m "feat(api): add checkpointsJson field to route schemas"
```

(Generated files under `backend/target/` and `frontend/src/api/` are gitignored — nothing else to stage.)

---

## Task 2: Backend persistence — migration + repository

**Files:**
- Create: `backend/src/main/resources/db/migration/V5__add_route_checkpoints.sql`
- Modify: `backend/src/main/java/com/trippyplanner/routes/RouteRepository.java`
- Modify: `backend/src/test/java/com/trippyplanner/routes/RouteRepositoryTest.java`

**Interfaces:**
- Consumes: `Route.getCheckpointsJson()`/`setCheckpointsJson()`, `CreateRouteRequest.getCheckpointsJson()`, `UpdateRouteRequest.getCheckpointsJson()` (Task 1).
- Produces: `routes.checkpoints_json` column, read/written by every existing `RouteRepository` method that already touches `routes`.

- [ ] **Step 1: Write the migration**

```sql
-- checkpoints_json stores an opaque JSON array of user-pinned arrival-time
-- checkpoints for the route (see docs/superpowers/specs/2026-09-05-checkpoint-arrival-times-design.md).
-- NULL means no stored checkpoints; the client falls back to a default.
ALTER TABLE routes ADD COLUMN checkpoints_json TEXT;
```

Save as `backend/src/main/resources/db/migration/V5__add_route_checkpoints.sql`.

- [ ] **Step 2: Write the failing repository tests**

Add to `RouteRepositoryTest.java` (after `findOwnerUserId`):

```java
    @Test
    void checkpointsJsonIsNullByDefault() {
        var saved = routeRepo.save(userId, sampleRequest());
        assertThat(saved.getCheckpointsJson()).isNull();
    }

    @Test
    void savesAndRetrievesCheckpointsJson() {
        var req = sampleRequest();
        req.setCheckpointsJson("[{\"id\":\"end\",\"distanceM\":1000}]");
        var saved = routeRepo.save(userId, req);
        assertThat(saved.getCheckpointsJson()).isEqualTo("[{\"id\":\"end\",\"distanceM\":1000}]");
        var reloaded = routeRepo.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getCheckpointsJson()).isEqualTo("[{\"id\":\"end\",\"distanceM\":1000}]");
    }

    @Test
    void updatesCheckpointsJson() {
        var saved = routeRepo.save(userId, sampleRequest());
        var update = new UpdateRouteRequest();
        update.setCheckpointsJson("[{\"id\":\"end\",\"distanceM\":500}]");
        var updated = routeRepo.update(saved.getId(), update).orElseThrow();
        assertThat(updated.getCheckpointsJson()).isEqualTo("[{\"id\":\"end\",\"distanceM\":500}]");
    }
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /workspace/backend && ./mvnw test -Dtest=RouteRepositoryTest
```

Expected: FAIL — `getCheckpointsJson`/`setCheckpointsJson` don't exist yet on the generated model, or the column doesn't exist (compile error is fine here, that's still "fails for the right reason").

- [ ] **Step 4: Implement — repository changes**

In `RouteRepository.java`, update `FULL_MAPPER`:

```java
    private static final RowMapper<Route> FULL_MAPPER = (rs, rowNum) -> {
        Route r = new Route();
        r.setId(rs.getObject("id", UUID.class));
        r.setName(rs.getString("name"));
        r.setAvgSpeedKmh(rs.getDouble("avg_speed_kmh"));
        r.setStartTime(rs.getObject("start_time", OffsetDateTime.class));
        r.setIsPublic(rs.getBoolean("is_public"));
        r.setCreatedAt(rs.getObject("created_at", OffsetDateTime.class));
        r.setGpxContent(rs.getString("gpx_content"));
        r.setCheckpointsJson(rs.getString("checkpoints_json"));
        return r;
    };
```

Update the two `SELECT` statements that build `Route` (in `findById` and `findByShareToken`) to include the column:

```java
    public Optional<Route> findById(UUID id) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at, gpx_content, checkpoints_json " +
            "FROM routes WHERE id = ?",
            FULL_MAPPER, id).stream().findFirst();
    }
```

```java
    public Optional<Route> findByShareToken(String token) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at, gpx_content, checkpoints_json " +
            "FROM routes WHERE share_token = ? AND is_public = true",
            FULL_MAPPER, token).stream().findFirst();
    }
```

Update `save()`:

```java
    public Route save(long userId, CreateRouteRequest req) {
        UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO routes (id, user_id, name, gpx_content, avg_speed_kmh, start_time, checkpoints_json) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            id, userId, req.getName(), req.getGpxContent(),
            req.getAvgSpeedKmh(), req.getStartTime(), req.getCheckpointsJson());
        return findById(id).orElseThrow();
    }
```

Update `update()` to add a branch, same pattern as the existing three:

```java
    public Optional<Route> update(UUID id, UpdateRouteRequest req) {
        List<String> sets = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (req.getName() != null) { sets.add("name = ?"); params.add(req.getName()); }
        if (req.getAvgSpeedKmh() != null) { sets.add("avg_speed_kmh = ?"); params.add(req.getAvgSpeedKmh()); }
        if (req.getStartTime() != null) { sets.add("start_time = ?"); params.add(req.getStartTime()); }
        if (req.getCheckpointsJson() != null) { sets.add("checkpoints_json = ?"); params.add(req.getCheckpointsJson()); }
        if (sets.isEmpty()) return findById(id);
        sets.add("updated_at = now()");
        params.add(id);
        jdbc.update("UPDATE routes SET " + String.join(", ", sets) + " WHERE id = ?", params.toArray());
        return findById(id);
    }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /workspace/backend && ./mvnw test -Dtest=RouteRepositoryTest,MigrationTest
```

Expected: PASS (`MigrationTest` confirms V5 applies cleanly against a fresh database).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/db/migration/V5__add_route_checkpoints.sql \
        backend/src/main/java/com/trippyplanner/routes/RouteRepository.java \
        backend/src/test/java/com/trippyplanner/routes/RouteRepositoryTest.java
git commit -m "feat(backend): persist checkpoints_json on routes"
```

---

## Task 3: Backend — `RoutesController` pass-through test

No production code changes expected (the controller already passes the full generated objects through), but add a regression test that would catch it if a future refactor breaks that.

**Files:**
- Modify: `backend/src/test/java/com/trippyplanner/routes/RoutesControllerTest.java`

- [ ] **Step 1: Write the test**

Add near the existing `getRouteReturns200WhenOwner` test:

```java
    @Test
    void createRoutePassesThroughCheckpointsJson() throws Exception {
        UUID id = UUID.randomUUID();
        Route created = sampleRoute(id);
        created.setCheckpointsJson("[{\"id\":\"end\",\"distanceM\":1000}]");
        when(MocksConfig.routeRepository.save(eq(1L), any())).thenReturn(created);

        mvc.perform(post("/routes")
                .requestAttr("userId", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"My Route\",\"gpxContent\":\"<gpx/>\",\"avgSpeedKmh\":20,"
                    + "\"startTime\":\"2026-01-01T08:00:00Z\","
                    + "\"checkpointsJson\":\"[{\\\"id\\\":\\\"end\\\",\\\"distanceM\\\":1000}]\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.checkpointsJson").value("[{\"id\":\"end\",\"distanceM\":1000}]"));
    }
```

Check the top of the file for existing `import static org.mockito.ArgumentMatchers.*;` (already present per the file header) so `eq`/`any` resolve.

- [ ] **Step 2: Run to verify it fails, then passes**

```bash
cd /workspace/backend && ./mvnw test -Dtest=RoutesControllerTest
```

It should already pass once Tasks 1-2 are done (no controller code changes needed) — if it fails, that means `RoutesController` needs an explicit fix, which would be a genuine bug caught by this test.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/com/trippyplanner/routes/RoutesControllerTest.java
git commit -m "test(backend): verify checkpointsJson passes through route creation"
```

---

## Task 4: `speedProfile.ts` — the arrival-time engine

**Files:**
- Create: `frontend/src/utils/speedProfile.ts`
- Create: `frontend/src/utils/speedProfile.test.ts`

**Interfaces:**
- Produces:
  - `interface Checkpoint { id: string; distanceM: number; arrivalTime: Date; pinned: boolean }`
  - `buildSequence(startTime: Date, checkpoints: Checkpoint[]): { distanceM: number; arrivalTime: Date }[]`
  - `computeArrivalTime(distanceM: number, startTime: Date, checkpoints: Checkpoint[]): Date`
  - `impliedSpeedKmh(a: { distanceM: number; arrivalTime: Date }, b: { distanceM: number; arrivalTime: Date }): number | null`
  - `defaultCheckpoints(totalDistanceM: number, avgSpeedKmh: number, startTime: Date): Checkpoint[]`

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/utils/speedProfile.test.ts
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
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /workspace/frontend && npx vitest run src/utils/speedProfile.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```typescript
// frontend/src/utils/speedProfile.ts
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

export function defaultCheckpoints(totalDistanceM: number, avgSpeedKmh: number, startTime: Date): Checkpoint[] {
  const hours = totalDistanceM / 1000 / avgSpeedKmh;
  return [{
    id: 'end',
    distanceM: totalDistanceM,
    arrivalTime: new Date(startTime.getTime() + hours * 3_600_000),
    pinned: false,
  }];
}
```

- [ ] **Step 4: Run to verify pass**

```bash
cd /workspace/frontend && npx vitest run src/utils/speedProfile.test.ts
```

Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/speedProfile.ts frontend/src/utils/speedProfile.test.ts
git commit -m "feat(frontend): add checkpoint-based arrival time engine"
```

---

## Task 5: `CheckpointOverlay` — decorative chart markers

**Files:**
- Modify: `frontend/src/theme/chartColors.ts`
- Modify: `frontend/src/theme/chartColors.test.ts`
- Create: `frontend/src/components/CheckpointOverlay.tsx`
- Modify: `frontend/src/components/ElevationChart.tsx`
- Modify: `frontend/src/components/ElevationChart.test.tsx`

**Interfaces:**
- Consumes: `Checkpoint` (Task 4).
- Produces: `<CheckpointOverlay checkpoints={...} data={...} />`, a chart-internal component rendered by `ElevationChart` — no other file needs to import it directly.

- [ ] **Step 1: Add palette colors (test first)**

Add to `chartColors.test.ts`'s existing `describe('chartPalette', ...)` block:

```typescript
  it('defines checkpoint marker colors', () => {
    expect(chartPalette.checkpointWaypoint).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(chartPalette.checkpointLocked).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(chartPalette.checkpointGuide).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
```

Run `npx vitest run src/theme/chartColors.test.ts` — expect FAIL (properties don't exist).

Add to `chartColors.ts`'s `ChartPalette` interface and `chartPalette` object:

```typescript
  checkpointWaypoint: string;
  checkpointLocked: string;
  checkpointGuide: string;
```

```typescript
  checkpointWaypoint: '#1b6ec2',
  checkpointLocked: '#256a4e',
  checkpointGuide: '#9aa4a0',
```

Run again — expect PASS.

- [ ] **Step 2: Write `CheckpointOverlay.tsx`**

No dedicated unit test — `ClimbOverlay.tsx` (the closest precedent, same `useXAxisScale`/`useYAxisScale`/`usePlotArea` hooks) has none either, since these hooks require a real chart render context that isn't practical to unit test in isolation. Coverage comes from the `ElevationChart.test.tsx` mock-and-assert pattern in Step 3.

```typescript
// frontend/src/components/CheckpointOverlay.tsx
import React from 'react';
import { useXAxisScale, useYAxisScale, usePlotArea } from 'recharts';
import type { Checkpoint } from '../utils/speedProfile';
import { chartPalette } from '../theme/chartColors';

interface ElevDataPoint {
  distance: number; // km
  elevation: number;
}

interface CheckpointOverlayProps {
  checkpoints: Checkpoint[];
  data: ElevDataPoint[];
}

// Note: this component only needs each checkpoint's distance to place a marker —
// the synthesized start point is always distanceKm 0, so no arrival-time value is
// ever read here. Do not add a startTime prop "for symmetry"; it would be unused.
const CheckpointOverlay: React.FC<CheckpointOverlayProps> = ({ checkpoints, data }) => {
  const palette = chartPalette;
  const xScale = useXAxisScale();
  const yScale = useYAxisScale('elevation');
  const plotArea = usePlotArea();

  if (!xScale || !yScale || !plotArea || !data.length) return null;

  const elevationAtKm = (km: number): number | null => {
    for (let i = 0; i < data.length - 1; i++) {
      const a = data[i], b = data[i + 1];
      if (km >= a.distance && km <= b.distance) {
        const span = b.distance - a.distance;
        const frac = span > 0 ? (km - a.distance) / span : 0;
        return a.elevation + frac * (b.elevation - a.elevation);
      }
    }
    return data[data.length - 1]?.elevation ?? null;
  };

  const points = [
    { distanceKm: 0, locked: true },
    ...checkpoints
      .slice()
      .sort((a, b) => a.distanceM - b.distanceM)
      .map(cp => ({ distanceKm: cp.distanceM / 1000, locked: cp.id === 'end' })),
  ];

  return (
    <g>
      {points.map((p, i) => {
        const px = xScale(p.distanceKm);
        const ele = elevationAtKm(p.distanceKm);
        if (typeof px !== 'number' || ele === null) return null;
        const py = yScale(ele);
        if (typeof py !== 'number') return null;
        return (
          <g key={i}>
            <line
              x1={px} y1={py} x2={px} y2={plotArea.y + plotArea.height}
              stroke={palette.checkpointGuide} strokeWidth={1} strokeDasharray="3 3"
            />
            <circle
              cx={px} cy={py} r={4}
              fill={p.locked ? palette.checkpointLocked : palette.checkpointWaypoint}
              stroke="white" strokeWidth={1.5}
            />
          </g>
        );
      })}
    </g>
  );
};

export { CheckpointOverlay };
```

- [ ] **Step 3: Wire into `ElevationChart` (test first)**

Add to `ElevationChart.test.tsx`'s `vi.mock` section:

```typescript
vi.mock('./CheckpointOverlay', () => ({
  CheckpointOverlay: () => <div data-testid="checkpoint-overlay" />,
}));
```

Add `checkpoints: []` to `defaultProps`, and a new test:

```typescript
  it('renders CheckpointOverlay', () => {
    render(<ElevationChart {...defaultProps} />);
    expect(screen.getByTestId('checkpoint-overlay')).toBeInTheDocument();
  });
```

Run `npx vitest run src/components/ElevationChart.test.tsx` — expect FAIL (`CheckpointOverlay` not rendered, and `ElevationChartProps` doesn't accept `checkpoints` yet).

Implement in `ElevationChart.tsx`: add to `ElevationChartProps`:

```typescript
  checkpoints: Checkpoint[];
```

(import `Checkpoint` from `../utils/speedProfile`, import `CheckpointOverlay` from `./CheckpointOverlay`), destructure the new prop, and render it next to `<ClimbOverlay>`:

```tsx
          <ClimbOverlay climbRanges={climbRanges} data={data} />
          <CheckpointOverlay checkpoints={checkpoints} data={data} />
```

Do not add a `startTime` prop to `ElevationChart` for this — `CheckpointOverlay` doesn't use it (see the note on its props above), and nothing else in `ElevationChart` needs it either.

Run tests again — expect PASS (including all pre-existing `ElevationChart` tests, since `checkpoints` is an additive prop with a fixed value in `defaultProps`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/theme/chartColors.ts frontend/src/theme/chartColors.test.ts \
        frontend/src/components/CheckpointOverlay.tsx \
        frontend/src/components/ElevationChart.tsx frontend/src/components/ElevationChart.test.tsx
git commit -m "feat(frontend): render checkpoint markers on the elevation curve"
```

---

## Task 6: `CheckpointTimeEditor` — shared time-entry popover

**Files:**
- Create: `frontend/src/components/CheckpointTimeEditor.tsx`
- Create: `frontend/src/components/CheckpointTimeEditor.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface Props {
    title: string;
    initialTime: Date;
    minTime: Date;   // exclusive lower bound
    maxTime: Date;   // exclusive upper bound
    position: { x: number; y: number };
    onSave: (time: Date) => void;
    onCancel: () => void;
  }
  ```
  Consumed by `CheckpointTrackRow` (Tasks 7-8).

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/components/CheckpointTimeEditor.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CheckpointTimeEditor } from './CheckpointTimeEditor';

afterEach(cleanup);

const DAY = new Date('2026-06-03T00:00:00');
const at = (h: number, m: number) => new Date(DAY.getFullYear(), DAY.getMonth(), DAY.getDate(), h, m);

describe('CheckpointTimeEditor', () => {
  it('pre-fills the time input from initialTime', () => {
    render(
      <CheckpointTimeEditor
        title="Set arrival time"
        initialTime={at(10, 30)}
        minTime={at(9, 0)}
        maxTime={at(12, 0)}
        position={{ x: 0, y: 0 }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/arrival time/i)).toHaveValue('10:30');
  });

  it('calls onSave with a Date on the same day as initialTime when Save is clicked with a valid time', () => {
    const onSave = vi.fn();
    render(
      <CheckpointTimeEditor
        title="Set arrival time"
        initialTime={at(10, 30)}
        minTime={at(9, 0)}
        maxTime={at(12, 0)}
        position={{ x: 0, y: 0 }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '11:15' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved: Date = onSave.mock.calls[0][0];
    expect(saved.getHours()).toBe(11);
    expect(saved.getMinutes()).toBe(15);
    expect(saved.getFullYear()).toBe(DAY.getFullYear());
    expect(saved.getMonth()).toBe(DAY.getMonth());
    expect(saved.getDate()).toBe(DAY.getDate());
  });

  it('shows a validation error and does not call onSave when the time is at or before minTime', () => {
    const onSave = vi.fn();
    render(
      <CheckpointTimeEditor
        title="Set arrival time"
        initialTime={at(10, 30)}
        minTime={at(9, 0)}
        maxTime={at(12, 0)}
        position={{ x: 0, y: 0 }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '08:00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/must stay between/i)).toBeInTheDocument();
  });

  it('shows a validation error and does not call onSave when the time is at or after maxTime', () => {
    const onSave = vi.fn();
    render(
      <CheckpointTimeEditor
        title="Set arrival time"
        initialTime={at(10, 30)}
        minTime={at(9, 0)}
        maxTime={at(12, 0)}
        position={{ x: 0, y: 0 }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '13:00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/must stay between/i)).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <CheckpointTimeEditor
        title="Set arrival time"
        initialTime={at(10, 30)}
        minTime={at(9, 0)}
        maxTime={at(12, 0)}
        position={{ x: 0, y: 0 }}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /workspace/frontend && npx vitest run src/components/CheckpointTimeEditor.test.tsx
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/CheckpointTimeEditor.tsx
import { useState } from 'react';

interface Props {
  title: string;
  initialTime: Date;
  minTime: Date;
  maxTime: Date;
  position: { x: number; y: number };
  onSave: (time: Date) => void;
  onCancel: () => void;
}

const toHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function CheckpointTimeEditor({ title, initialTime, minTime, maxTime, position, onSave, onCancel }: Props) {
  const [value, setValue] = useState(toHHMM(initialTime));
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const [hours, minutes] = value.split(':').map(Number);
    const candidate = new Date(initialTime);
    candidate.setHours(hours, minutes, 0, 0);

    if (candidate.getTime() <= minTime.getTime() || candidate.getTime() >= maxTime.getTime()) {
      setError('Time must stay between the neighboring checkpoints.');
      return;
    }
    setError(null);
    onSave(candidate);
  }

  return (
    <div
      className="fixed bg-base-100 shadow-lg rounded-lg p-3 z-50 w-56 text-sm"
      style={{ left: position.x, top: position.y }}
    >
      <div className="font-semibold mb-2">{title}</div>
      <label htmlFor="checkpoint-time-input" className="label pb-1">
        <span className="label-text text-xs">Arrival time</span>
      </label>
      <input
        id="checkpoint-time-input"
        type="time"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input input-bordered input-sm w-full mb-2"
      />
      {error && <div className="text-error text-xs mb-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn btn-xs" onClick={onCancel}>Cancel</button>
        <button className="btn btn-xs btn-primary" onClick={handleSave}>Save</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

```bash
cd /workspace/frontend && npx vitest run src/components/CheckpointTimeEditor.test.tsx
```

Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CheckpointTimeEditor.tsx frontend/src/components/CheckpointTimeEditor.test.tsx
git commit -m "feat(frontend): add shared checkpoint time-entry popover"
```

---

## Task 7: `CheckpointTrackRow` — structure + add-checkpoint flow

**Files:**
- Create: `frontend/src/components/CheckpointTrackRow.tsx`
- Create: `frontend/src/components/CheckpointTrackRow.test.tsx`

**Interfaces:**
- Consumes: `Checkpoint`, `computeArrivalTime`, `impliedSpeedKmh` (Task 4); `CheckpointTimeEditor` (Task 6); existing `ConfirmDialog` (`frontend/src/components/ConfirmDialog.tsx`).
- Produces:
  ```ts
  interface Props {
    checkpoints: Checkpoint[];
    startTime: Date;
    totalDistanceM: number;
    distanceRange: [number, number]; // km, matches WindArrowRow's convention
    chartWidth: number;
    onChange: (next: Checkpoint[]) => void;
  }
  ```
  `<CheckpointTrackRow>`, consumed by `App.tsx` (Task 11) and internally extended by Task 8 (drag + context menu + cascade — same file/component, added in that task).

Distances in this component are handled in **km** for pixel math (matching `WindArrowRow`'s `distanceRange`/`chartWidth` convention) and converted to/from **meters** only at the `Checkpoint`/`onChange` boundary, since `Checkpoint.distanceM` is meters.

- [ ] **Step 1: Write the failing tests for structure + add flow**

```tsx
// frontend/src/components/CheckpointTrackRow.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CheckpointTrackRow } from './CheckpointTrackRow';
import type { Checkpoint } from '../utils/speedProfile';

afterEach(cleanup);

const START = new Date('2026-06-03T08:00:00');
const endCp = (distanceM: number, minutesFromStart: number): Checkpoint => ({
  id: 'end', distanceM, arrivalTime: new Date(START.getTime() + minutesFromStart * 60_000), pinned: false,
});

function stubRect(el: Element, { left, width }: { left: number; width: number }) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left, right: left + width, width, top: 0, bottom: 20, height: 20, x: left, y: 0, toJSON: () => ({}),
  });
}

describe('CheckpointTrackRow', () => {
  it('renders a marker for the end checkpoint', () => {
    const { container } = render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    expect(container.querySelectorAll('[data-checkpoint-marker]')).toHaveLength(2); // synthesized start + end
  });

  it('opens an "Add checkpoint here?" confirmation when the empty track is clicked', () => {
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const track = screen.getByTestId('checkpoint-track-line');
    stubRect(track.parentElement!, { left: 0, width: 800 });
    fireEvent.click(track, { clientX: 400 }); // ~5km of 10km
    expect(screen.getByText(/add checkpoint here/i)).toBeInTheDocument();
  });

  it('does not open the confirmation when clicking too close to an existing checkpoint', () => {
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const track = screen.getByTestId('checkpoint-track-line');
    stubRect(track.parentElement!, { left: 0, width: 800 });
    // 745 = PLOT_LEFT(55) + plotWidth(800-55-55=690) — the exact pixel for the 10km
    // end checkpoint within an 800px-wide stubbed rect; NOT 795 (the div's raw right
    // edge), since PLOT_RIGHT_OFFSET leaves a 55px margin past the last plotted point.
    fireEvent.click(track, { clientX: 745 }); // exactly at the end checkpoint
    expect(screen.queryByText(/add checkpoint here/i)).not.toBeInTheDocument();
  });

  it('opens the time editor pre-filled with an interpolated estimate after confirming add, and inserts a pinned waypoint on save', () => {
    const onChange = vi.fn();
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 60)]} // 10km in 60min = 10km/h
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const track = screen.getByTestId('checkpoint-track-line');
    stubRect(track.parentElement!, { left: 0, width: 800 });
    fireEvent.click(track, { clientX: 400 }); // 5km
    fireEvent.click(screen.getByRole('button', { name: /yes, add/i }));

    // Interpolated estimate at 5km of a 10km/60min segment = 30min → 08:30
    expect(screen.getByLabelText(/arrival time/i)).toHaveValue('08:30');

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next: Checkpoint[] = onChange.mock.calls[0][0];
    expect(next).toHaveLength(2);
    const waypoint = next.find(cp => cp.id !== 'end')!;
    expect(waypoint.pinned).toBe(true);
    expect(waypoint.distanceM).toBeCloseTo(5_000, -2);
  });

  it('cancelling the add-confirmation does not call onChange', () => {
    const onChange = vi.fn();
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const track = screen.getByTestId('checkpoint-track-line');
    stubRect(track.parentElement!, { left: 0, width: 800 });
    fireEvent.click(track, { clientX: 400 });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/add checkpoint here/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /workspace/frontend && npx vitest run src/components/CheckpointTrackRow.test.tsx
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement structure + add flow**

```tsx
// frontend/src/components/CheckpointTrackRow.tsx
import { useState } from 'react';
import type { Checkpoint } from '../utils/speedProfile';
import { computeArrivalTime, impliedSpeedKmh } from '../utils/speedProfile';
import { CheckpointTimeEditor } from './CheckpointTimeEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { CHART_MARGIN_LEFT, CHART_YAXIS_LEFT_WIDTH } from './chartConstants';
import { chartPalette } from '../theme/chartColors';

interface Props {
  checkpoints: Checkpoint[];
  startTime: Date;
  totalDistanceM: number;
  distanceRange: [number, number]; // km
  chartWidth: number;
  onChange: (next: Checkpoint[]) => void;
}

const PLOT_LEFT = CHART_MARGIN_LEFT + CHART_YAXIS_LEFT_WIDTH;
const PLOT_RIGHT_OFFSET = 55;

interface FullPoint { distanceM: number; arrivalTime: Date; id: string | 'start' }

function fullSequence(checkpoints: Checkpoint[], startTime: Date): FullPoint[] {
  return [
    { distanceM: 0, arrivalTime: startTime, id: 'start' },
    ...checkpoints.slice().sort((a, b) => a.distanceM - b.distanceM).map(cp => ({ ...cp })),
  ];
}

export function CheckpointTrackRow({ checkpoints, startTime, totalDistanceM, distanceRange, chartWidth, onChange }: Props) {
  const [dMin, dMax] = distanceRange;
  const plotWidth = chartWidth - PLOT_LEFT - PLOT_RIGHT_OFFSET;
  const xOf = (km: number) => PLOT_LEFT + ((km - dMin) / (dMax - dMin)) * plotWidth;
  const kmOf = (x: number) => dMin + ((x - PLOT_LEFT) / plotWidth) * (dMax - dMin);

  const [pendingAddKm, setPendingAddKm] = useState<number | null>(null);
  const [editor, setEditor] = useState<{
    title: string;
    initialTime: Date;
    minTime: Date;
    maxTime: Date;
    position: { x: number; y: number };
    onSave: (time: Date) => void;
  } | null>(null);

  const sequence = fullSequence(checkpoints, startTime);

  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    // Measure the wrapper (this element's parent), not the track-line div itself —
    // xOf/kmOf both bake PLOT_LEFT in as an offset from the wrapper's own left edge,
    // and the track-line div is already inset by PLOT_LEFT within that wrapper, so
    // using its own rect here would double-count that inset in a real browser layout
    // (invisible in jsdom-stubbed tests, since jsdom doesn't compute real layout —
    // this must match the same measurement point onMarkerMouseDown uses for drag).
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const km = kmOf(x);
    // PLOT_RIGHT_OFFSET/PLOT_LEFT leave empty margin on each side of the plotted
    // route within this element's own width — a click landing in that margin maps
    // to a distance outside [dMin, dMax] and must be rejected, not clamped, since
    // silently clamping would let a click far into the margin add a checkpoint
    // right at the route's start/end instead of doing nothing as the user'd expect.
    if (km < dMin || km > dMax) return;
    const tooClose = sequence.some(p => Math.abs(p.distanceM / 1000 - km) < (dMax - dMin) * 0.01);
    if (tooClose) return;
    setPendingAddKm(km);
  }

  function confirmAdd(clientX: number, clientY: number) {
    if (pendingAddKm === null) return;
    const distanceM = pendingAddKm * 1000;
    let prev = sequence[0], next = sequence[sequence.length - 1];
    for (let i = 0; i < sequence.length - 1; i++) {
      if (distanceM >= sequence[i].distanceM && distanceM <= sequence[i + 1].distanceM) {
        prev = sequence[i]; next = sequence[i + 1]; break;
      }
    }
    const estimate = computeArrivalTime(distanceM, startTime, checkpoints);
    setPendingAddKm(null);
    setEditor({
      title: 'Set arrival time',
      initialTime: estimate,
      minTime: prev.arrivalTime,
      maxTime: next.arrivalTime,
      position: { x: clientX, y: clientY },
      onSave: (time) => {
        const waypoint: Checkpoint = {
          id: `wp-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
          distanceM,
          arrivalTime: time,
          pinned: true,
        };
        onChange([...checkpoints, waypoint]);
        setEditor(null);
      },
    });
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        data-testid="checkpoint-track-line"
        onClick={handleTrackClick}
        style={{
          position: 'absolute',
          left: PLOT_LEFT,
          width: plotWidth,
          top: '50%',
          height: 2,
          background: '#d3dad6',
          cursor: 'copy',
        }}
      />
      {sequence.map((p) => (
        <div
          key={p.id}
          data-checkpoint-marker
          style={{
            position: 'absolute',
            left: xOf(p.distanceM / 1000) - 6,
            top: 'calc(50% - 6px)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: p.id === 'start' || p.id === 'end' ? chartPalette.checkpointLocked : chartPalette.checkpointWaypoint,
            border: '2px solid white',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
          }}
        />
      ))}

      {pendingAddKm !== null && (
        <ConfirmDialog
          open={true}
          title="Add checkpoint here?"
          message={`${pendingAddKm.toFixed(1)} km from start`}
          confirming={false}
          onCancel={() => setPendingAddKm(null)}
          onConfirm={() => confirmAdd(window.innerWidth / 2, window.innerHeight / 2)}
        />
      )}

      {editor && (
        <CheckpointTimeEditor
          title={editor.title}
          initialTime={editor.initialTime}
          minTime={editor.minTime}
          maxTime={editor.maxTime}
          position={editor.position}
          onSave={editor.onSave}
          onCancel={() => setEditor(null)}
        />
      )}
    </div>
  );
}
```

`fullSequence` and `impliedSpeedKmh` stay internal to this file — App.tsx's sidebar Checkpoints panel (Task 11) gets the same data straight from `buildSequence`/`impliedSpeedKmh` in `../utils/speedProfile` (Task 4) instead of importing it back out of this component, since `speedProfile.ts` is the shared source of truth and this component's local `fullSequence` (with its extra `id` field, used only for React keys and drag/menu targeting here) is specific to this component's own rendering needs.

Note: `ConfirmDialog`'s `message` prop only takes a plain string (no markup), which is fine here — `"${pendingAddKm.toFixed(1)} km from start"` renders as-is.

- [ ] **Step 4: Run to verify pass**

```bash
cd /workspace/frontend && npx vitest run src/components/CheckpointTrackRow.test.tsx
```

Expected: PASS, all 5 cases. The test stubs `track.parentElement`'s rect (the wrapper), matching `handleTrackClick`'s `(e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()` — if the "too close" click-position math doesn't line up, confirm both the test's stub target and the implementation's measurement point are the wrapper, not the track-line div itself (see the comment in `handleTrackClick`'s implementation, Step 3).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CheckpointTrackRow.tsx frontend/src/components/CheckpointTrackRow.test.tsx
git commit -m "feat(frontend): add checkpoint track row with add-checkpoint flow"
```

---

## Task 8: `CheckpointTrackRow` — drag, right-click menu, delete, cascade

**Files:**
- Modify: `frontend/src/components/CheckpointTrackRow.tsx`
- Modify: `frontend/src/components/CheckpointTrackRow.test.tsx`

**Interfaces:**
- Extends Task 7's component with the mock's remaining three interactions. No prop/interface changes.

- [ ] **Step 1: Write the failing tests**

Append to `CheckpointTrackRow.test.tsx`:

```tsx
describe('CheckpointTrackRow — drag', () => {
  it('dragging a waypoint changes its distance but not its time, and calls onChange', () => {
    const onChange = vi.fn();
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true };
    render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const marker = screen.getAllByTestId('checkpoint-track-line')[0].parentElement!.querySelector('[data-checkpoint-marker][data-draggable="true"]')!;
    stubRect(marker.parentElement!, { left: 0, width: 800 });
    fireEvent.mouseDown(marker, { clientX: 240 });
    fireEvent.mouseMove(document, { clientX: 400 }); // drag to ~5km
    fireEvent.mouseUp(document);

    expect(onChange).toHaveBeenCalled();
    const next: Checkpoint[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const moved = next.find(cp => cp.id === 'wp-1')!;
    expect(moved.distanceM).toBeCloseTo(5_000, -2);
    expect(moved.arrivalTime.getTime()).toBe(waypoint.arrivalTime.getTime()); // unchanged
  });
});

describe('CheckpointTrackRow — right-click menu', () => {
  it('shows Change time and Delete for a waypoint', () => {
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true };
    render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const marker = document.querySelector('[data-checkpoint-marker][data-draggable="true"]')!;
    fireEvent.contextMenu(marker);
    expect(screen.getByText(/change time/i)).toBeInTheDocument();
    expect(screen.getByText(/delete checkpoint/i)).toBeInTheDocument();
  });

  it('hides Delete for the end checkpoint', () => {
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const endMarker = document.querySelector('[data-checkpoint-marker][data-checkpoint-id="end"]')!;
    fireEvent.contextMenu(endMarker);
    expect(screen.getByText(/change time/i)).toBeInTheDocument();
    expect(screen.queryByText(/delete checkpoint/i)).not.toBeInTheDocument();
  });

  it('does not attach a context menu to the start checkpoint', () => {
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const startMarker = document.querySelector('[data-checkpoint-marker][data-checkpoint-id="start"]')!;
    fireEvent.contextMenu(startMarker);
    expect(screen.queryByText(/change time/i)).not.toBeInTheDocument();
  });

  it('deleting a waypoint removes it and calls onChange', () => {
    const onChange = vi.fn();
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true };
    render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const marker = document.querySelector('[data-checkpoint-marker][data-draggable="true"]')!;
    fireEvent.contextMenu(marker);
    fireEvent.click(screen.getByText(/delete checkpoint/i));
    const next: Checkpoint[] = onChange.mock.calls[0][0];
    expect(next.find(cp => cp.id === 'wp-1')).toBeUndefined();
  });
});

describe('CheckpointTrackRow — change time + cascade', () => {
  it('changing a time with no downstream checkpoints does not show a cascade prompt', () => {
    const onChange = vi.fn();
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const endMarker = document.querySelector('[data-checkpoint-marker][data-checkpoint-id="end"]')!;
    fireEvent.contextMenu(endMarker);
    fireEvent.click(screen.getByText(/change time/i));
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '09:30' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.queryByText(/shift/i)).not.toBeInTheDocument();
    const next: Checkpoint[] = onChange.mock.calls[0][0];
    expect(next.find(cp => cp.id === 'end')!.pinned).toBe(true);
  });

  it('changing a waypoint\'s time with a downstream checkpoint shows Shift/Keep, and Shift moves downstream times by the same delta', () => {
    const onChange = vi.fn();
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true }; // 08:20
    render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 60)]} // end at 09:00
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const marker = document.querySelector('[data-checkpoint-marker][data-draggable="true"]')!;
    fireEvent.contextMenu(marker);
    fireEvent.click(screen.getByText(/change time/i));
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '08:40' } }); // +20min
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText(/shift/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /shift times/i }));

    const next: Checkpoint[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const shiftedEnd = next.find(cp => cp.id === 'end')!;
    expect(shiftedEnd.arrivalTime.getTime()).toBe(START.getTime() + 80 * 60_000); // 09:00 + 20min
  });

  it('choosing Keep times leaves downstream checkpoints untouched', () => {
    const onChange = vi.fn();
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true };
    render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const marker = document.querySelector('[data-checkpoint-marker][data-draggable="true"]')!;
    fireEvent.contextMenu(marker);
    fireEvent.click(screen.getByText(/change time/i));
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '08:40' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    fireEvent.click(screen.getByRole('button', { name: /keep times/i }));

    const next: Checkpoint[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const untouchedEnd = next.find(cp => cp.id === 'end')!;
    expect(untouchedEnd.arrivalTime.getTime()).toBe(START.getTime() + 60 * 60_000); // still 09:00
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /workspace/frontend && npx vitest run src/components/CheckpointTrackRow.test.tsx
```

Expected: FAIL — no drag/context-menu/cascade behavior implemented yet, and markers don't carry `data-draggable`/`data-checkpoint-id` attributes yet.

- [ ] **Step 3: Implement**

Replace the marker-rendering block and add the new interaction state/handlers in `CheckpointTrackRow.tsx`:

```tsx
  const [dragId, setDragId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cascade, setCascade] = useState<{
    downstreamIds: string[];
    deltaMs: number;
    pendingCheckpoints: Checkpoint[];
    position: { x: number; y: number };
  } | null>(null);

  function neighborsOf(id: string): { prev: FullPoint; next: FullPoint | null } {
    const idx = sequence.findIndex(p => p.id === id);
    return { prev: sequence[idx - 1], next: idx + 1 < sequence.length ? sequence[idx + 1] : null };
  }

  function onMarkerMouseDown(e: React.MouseEvent, id: string) {
    e.preventDefault();
    setDragId(id);
    const trackEl = e.currentTarget.parentElement as HTMLElement;

    function onMove(ev: MouseEvent) {
      const rect = trackEl.getBoundingClientRect();
      let km = kmOf(ev.clientX - rect.left);
      const { prev, next } = neighborsOf(id);
      const minKm = prev.distanceM / 1000 + (dMax - dMin) * 0.005;
      const maxKm = next ? next.distanceM / 1000 - (dMax - dMin) * 0.005 : dMax;
      km = Math.min(maxKm, Math.max(minKm, km));
      onChange(checkpoints.map(cp => cp.id === id ? { ...cp, distanceM: km * 1000 } : cp));
    }
    function onUp() {
      setDragId(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onMarkerContextMenu(e: React.MouseEvent, id: string) {
    e.preventDefault();
    setMenu({ id, x: e.clientX, y: e.clientY });
  }

  function menuChangeTime() {
    if (!menu) return;
    const { id, x, y } = menu;
    const cp = checkpoints.find(c => c.id === id)!;
    const { prev, next } = neighborsOf(id);
    setMenu(null);
    setEditor({
      title: 'Change arrival time',
      initialTime: cp.arrivalTime,
      minTime: prev.arrivalTime,
      maxTime: next ? next.arrivalTime : new Date(cp.arrivalTime.getTime() + 365 * 24 * 3_600_000),
      position: { x, y },
      onSave: (time) => {
        const idx = sequence.findIndex(p => p.id === id);
        // idx is this checkpoint's position within [start, ...checkpoints] — everything
        // after it is a real downstream checkpoint ('start' can never appear here,
        // since it's always index 0).
        const downstream = sequence.slice(idx + 1);
        const deltaMs = time.getTime() - cp.arrivalTime.getTime();
        const updated = checkpoints.map(c => c.id === id ? { ...c, arrivalTime: time, pinned: true } : c);
        setEditor(null);
        if (deltaMs !== 0 && downstream.length > 0) {
          setCascade({
            downstreamIds: downstream.map(p => p.id),
            deltaMs,
            pendingCheckpoints: updated,
            position: { x, y },
          });
        } else {
          onChange(updated);
        }
      },
    });
  }

  function menuDelete() {
    if (!menu) return;
    onChange(checkpoints.filter(c => c.id !== menu.id));
    setMenu(null);
  }

  function cascadeShift() {
    if (!cascade) return;
    onChange(cascade.pendingCheckpoints.map(c =>
      cascade.downstreamIds.includes(c.id) ? { ...c, arrivalTime: new Date(c.arrivalTime.getTime() + cascade.deltaMs) } : c
    ));
    setCascade(null);
  }

  function cascadeKeep() {
    if (!cascade) return;
    onChange(cascade.pendingCheckpoints);
    setCascade(null);
  }
```

Replace the marker `.map()` block with:

```tsx
      {sequence.map((p) => {
        const isLocked = p.id === 'start' || p.id === 'end';
        return (
          <div
            key={p.id}
            data-checkpoint-marker
            data-checkpoint-id={p.id}
            data-draggable={!isLocked}
            onMouseDown={isLocked ? undefined : (e) => onMarkerMouseDown(e, p.id)}
            onContextMenu={p.id === 'start' ? undefined : (e) => onMarkerContextMenu(e, p.id)}
            style={{
              position: 'absolute',
              left: xOf(p.distanceM / 1000) - 6,
              top: 'calc(50% - 6px)',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: isLocked ? chartPalette.checkpointLocked : chartPalette.checkpointWaypoint,
              border: '2px solid white',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
              cursor: isLocked ? 'default' : 'grab',
            }}
          />
        );
      })}

      {menu && (
        <div className="fixed bg-base-100 shadow-lg rounded-lg p-1 z-50 text-sm" style={{ left: menu.x, top: menu.y }}>
          <button className="block w-full text-left px-3 py-1.5 rounded hover:bg-base-200" onClick={menuChangeTime}>
            Change time
          </button>
          {menu.id !== 'end' && (
            <button className="block w-full text-left px-3 py-1.5 rounded hover:bg-base-200 text-error" onClick={menuDelete}>
              Delete checkpoint
            </button>
          )}
        </div>
      )}

      {cascade && (
        <div className="fixed bg-neutral text-neutral-content rounded-lg p-3 z-50 text-sm max-w-xs" style={{ left: cascade.position.x, top: cascade.position.y }}>
          <div className="mb-2">
            Shift {cascade.downstreamIds.length} later checkpoint{cascade.downstreamIds.length > 1 ? 's' : ''} by{' '}
            {cascade.deltaMs > 0 ? '+' : ''}{Math.round(cascade.deltaMs / 60_000)} min, or keep their times and recalculate speed?
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-xs" onClick={cascadeKeep}>Keep times</button>
            <button className="btn btn-xs btn-primary" onClick={cascadeShift}>Shift times</button>
          </div>
        </div>
      )}
```

Note: clicking a marker (`onMouseDown`) must not also bubble into `handleTrackClick`'s add-checkpoint flow on the parent track line — since the marker `div`s are siblings of the track line (not children), no bubbling conflict exists; verify this holds once running the tests, and add `e.stopPropagation()` in `onMarkerMouseDown` only if a test demonstrates it's needed.

- [ ] **Step 4: Run to verify pass**

```bash
cd /workspace/frontend && npx vitest run src/components/CheckpointTrackRow.test.tsx
```

Expected: PASS, all cases from both Task 7 and Task 8 (re-run the full file — Task 7's tests must still pass unmodified).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CheckpointTrackRow.tsx frontend/src/components/CheckpointTrackRow.test.tsx
git commit -m "feat(frontend): add drag, right-click menu, delete, and cascade to checkpoint track"
```

---

## Task 9: `useWeatherChartData` — switch to checkpoint-based timing

**Files:**
- Modify: `frontend/src/hooks/useWeatherChartData.ts`
- Modify: `frontend/src/hooks/useWeatherChartData.test.ts`

**Interfaces:**
- Consumes: `Checkpoint`, `computeArrivalTime`, `defaultCheckpoints` (Task 4).
- Produces: `buildChartData`/`useWeatherChartData` now take `checkpoints`/`weatherCheckpoints: Checkpoint[]` instead of `avgSpeed`/`weatherAvgSpeed: number`. Consumed by `App.tsx` (Task 10).

- [ ] **Step 1: Update every existing test to pass `checkpoints` instead of `avgSpeed`**

In `useWeatherChartData.test.ts`, add the import:

```typescript
import { defaultCheckpoints } from '../utils/speedProfile';
```

Replace the shared fixture:

```typescript
const START = new Date('2026-06-03T08:00:00Z');
const BASE = { chartWidth: 100, checkpoints: defaultCheckpoints(0, 20, START), startTime: START };
```

`defaultCheckpoints(0, 20, START)` produces an end checkpoint at distance 0 — fine for the empty-route test, but every other test builds its own `route` with a real `totalDistance`, so each call site needs its own `checkpoints: defaultCheckpoints(route.totalDistance, 20, START)` in place of `avgSpeed: 20`. Go through each test and replace, e.g.:

```typescript
  it('maps elevation and distance correctly for a single point', () => {
    const route = makeRoute([{ distance: 0, ele: 123.7 }]);
    const result = buildChartData({ route, weatherPoints: [], chartWidth: 100, startTime: START, checkpoints: defaultCheckpoints(route.totalDistance, 20, START) });
    ...
```

Apply the same substitution — `avgSpeed: 20` → `checkpoints: defaultCheckpoints(route.totalDistance, 20, START)`, dropping `...BASE` spreads that relied on the old shared `avgSpeed` — to every one of the 13 existing test cases. For the two tests that pass both live and "weather" params (`'freezes the interpolation model...'` and `'re-interpolates once weatherAvgSpeed/weatherStartTime catch up...'`), replace:

```typescript
    const fetched = buildChartData({
      route, weatherPoints, chartWidth: 1000, checkpoints: defaultCheckpoints(route.totalDistance, 20, START), startTime: START,
      weatherCheckpoints: defaultCheckpoints(route.totalDistance, 20, START), weatherStartTime: START,
    });

    const edited = buildChartData({
      route, weatherPoints, chartWidth: 1000, checkpoints: defaultCheckpoints(route.totalDistance, 40, START), startTime: new Date(START.getTime() + 3_600_000),
      weatherCheckpoints: defaultCheckpoints(route.totalDistance, 20, START), weatherStartTime: START,
    });
```

(mirroring the old `avgSpeed: 20`→live vs. `weatherAvgSpeed: 20`→frozen split), and similarly for the "re-interpolates" test with both sides at `checkpoints`/`weatherCheckpoints` using `40`.

The `'uses time-based interpolation factor...'` test's leading comment references the old formula directly — replace it with:

```typescript
  it('uses time-based interpolation factor, not index-based', () => {
    // Route: 3 pts at 0m, 1000m, 2000m. A single end checkpoint at 20km/h gives
    // computeArrivalTime(1000, ...) = START + (1000 / 20000) * 3_600_000 = START + 180_000ms (3 min)
    // — the same number the old avgSpeed formula gave, since one end-only checkpoint
    // reproduces constant-speed timing exactly (Task 4's regression test).
    // Sample times: sample0=START, sample2=START+1h
    //   → t at pt[1] = 3min / 1h = 0.05, far from 0.5 (index midpoint)
```

(the rest of that test's body — the `route`/`result`/assertions below the comment — only needs the mechanical `avgSpeed: 20` → `checkpoints: defaultCheckpoints(route.totalDistance, 20, START)` substitution described above, same as every other test in this file).

- [ ] **Step 2: Run to verify failure**

```bash
cd /workspace/frontend && npx vitest run src/hooks/useWeatherChartData.test.ts
```

Expected: FAIL — `buildChartData` doesn't accept `checkpoints` yet (type error / runtime `undefined` used as a number).

- [ ] **Step 3: Implement**

In `useWeatherChartData.ts`, update imports:

```typescript
import type { Checkpoint } from '../utils/speedProfile';
import { computeArrivalTime } from '../utils/speedProfile';
```

Update `buildChartData`'s signature and body:

```typescript
export function buildChartData({
  route,
  weatherPoints,
  chartWidth,
  startTime,
  checkpoints,
  weatherStartTime = startTime,
  weatherCheckpoints = checkpoints,
}: {
  route: RouteData;
  weatherPoints: WeatherSample[];
  chartWidth: number;
  startTime: Date;
  checkpoints: Checkpoint[];
  weatherStartTime?: Date;
  weatherCheckpoints?: Checkpoint[];
}): ChartDataPoint[] {
  if (!route.points.length) return [];

  const d: ChartDataPoint[] = route.points.map(pt => ({
    distance: pt.distance / 1000,
    elevation: Math.round(pt.ele),
    temp: undefined,
    precipProb: undefined,
    precipitation: undefined,
    windSpeed: undefined,
    windDeg: undefined,
    time: computeArrivalTime(pt.distance, startTime, checkpoints).getTime(),
    isSample: false,
  }));
```

(rest of the function body up to `modeledTimeAt` is unchanged); update `modeledTimeAt`:

```typescript
  const modeledTimeAt = (distanceKm: number) =>
    computeArrivalTime(distanceKm * 1000, weatherStartTime, weatherCheckpoints).getTime();
```

Update the exported hook similarly:

```typescript
export function useWeatherChartData({
  route,
  weatherPoints,
  chartWidth,
  startTime,
  checkpoints,
  weatherStartTime,
  weatherCheckpoints,
}: {
  route: RouteData | null;
  weatherPoints: WeatherSample[];
  chartWidth: number;
  startTime: Date;
  checkpoints: Checkpoint[];
  weatherStartTime?: Date;
  weatherCheckpoints?: Checkpoint[];
}): ChartDataPoint[] {
  return useMemo(
    () => route ? buildChartData({ route, weatherPoints, chartWidth, startTime, checkpoints, weatherStartTime, weatherCheckpoints }) : [],
    [route, weatherPoints, chartWidth, startTime, checkpoints, weatherStartTime, weatherCheckpoints],
  );
}
```

- [ ] **Step 4: Run to verify pass**

```bash
cd /workspace/frontend && npx vitest run src/hooks/useWeatherChartData.test.ts
```

Expected: PASS, all 13 cases (numerically identical results, since a single end-only checkpoint reproduces the old constant-speed formula exactly).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useWeatherChartData.ts frontend/src/hooks/useWeatherChartData.test.ts
git commit -m "refactor(frontend): drive chart arrival times from checkpoints"
```

---

## Task 10: `App.tsx` — checkpoints state and computation wiring

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `Checkpoint`, `computeArrivalTime`, `defaultCheckpoints` (Task 4); `useWeatherChartData`'s new signature (Task 9).
- Produces: `checkpoints` state, threaded into `lastFetchedParams`/`isDirty`; `updateWeather`'s new signature `(currentRoute, checkpoints, start, provider)`. UI rendering of `CheckpointTrackRow`/sidebar panel is Task 11 — this task is computation-only, so existing UI-focused tests keep passing unmodified.

This task is computation-only — `checkpoints` state exists and drives `updateWeather`/`isDirty`/`useWeatherChartData`, but nothing renders it yet (that's Task 11, where `CheckpointTrackRow` gets mounted and a real interaction test exercises the dirty-flag behavior end-to-end through it). Verification here is via the full existing `App.test.tsx` suite passing unmodified — see Step 4.

- [ ] **Step 1: Implement state, auto-track effect, and `isDirty`**

Add the import:

```typescript
import type { Checkpoint } from './utils/speedProfile';
import { computeArrivalTime, defaultCheckpoints } from './utils/speedProfile';
```

Add state (near `avgSpeed`):

```typescript
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
```

Add the auto-track effect (near the other `React.useEffect` calls):

```typescript
  // Checkpoints not yet manually edited ("pinned: false") keep tracking Average
  // Speed / Start Time live; once a checkpoint's time is explicitly set it detaches.
  React.useEffect(() => {
    setCheckpoints(cps => cps.map(cp => cp.pinned ? cp : {
      ...cp,
      arrivalTime: new Date(startTime.getTime() + (cp.distanceM / (avgSpeed * 1000)) * 3_600_000),
    }));
  }, [avgSpeed, startTime]);
```

Update `lastFetchedParams`'s type and `isDirty`:

```typescript
  const [lastFetchedParams, setLastFetchedParams] = useState<{
    avgSpeed: number;
    startTime: Date;
    selectedProvider: WeatherProvider;
    checkpoints: Checkpoint[];
  } | null>(null);
```

```typescript
  const isDirty = route !== null &&
    lastFetchedParams !== null && (
      lastFetchedParams.avgSpeed !== avgSpeed ||
      lastFetchedParams.startTime.getTime() !== startTime.getTime() ||
      lastFetchedParams.selectedProvider !== selectedProvider ||
      JSON.stringify(lastFetchedParams.checkpoints) !== JSON.stringify(checkpoints)
    );
```

- [ ] **Step 2: Refactor `updateWeather` to use checkpoints**

```typescript
  const updateWeather = useCallback(async (currentRoute: RouteData, cps: Checkpoint[], start: Date, provider: WeatherProvider): Promise<boolean> => {
    let weatherPointsDistance = 5000;
    let weatherPointsCount = currentRoute.totalDistance / weatherPointsDistance;
    if (weatherPointsCount < 10) {
      weatherPointsCount = 10;
      weatherPointsDistance = currentRoute.totalDistance / weatherPointsCount;
    }
    const requestMap = new Map<number, WeatherRequest>();
    const metaMap = new Map<number, { point: RoutePoint; arrivalTime: Date; label: string }>();
    const seenIndices = new Set<number>();
    for (let i = 0; i <= weatherPointsCount; i++) {
      const distance = i * weatherPointsDistance;
      const idx = currentRoute.points.findIndex(p => p.distance >= distance);
      const pointIdx = idx === -1 ? currentRoute.points.length - 1 : idx;
      if (seenIndices.has(pointIdx)) continue;
      seenIndices.add(pointIdx);
      const point = currentRoute.points[pointIdx];
      const arrivalTime = computeArrivalTime(distance, start, cps);
      requestMap.set(pointIdx, { lat: point.lat, lon: point.lng, timestamp: arrivalTime.getTime() / 1000 });
      metaMap.set(pointIdx, { point, arrivalTime, label: String(pointIdx) });
    }
    try {
      const weatherResult = await provider.fetchWeather(requestMap);
      const filtered: WeatherSample[] = [];
      for (const [key, weather] of weatherResult) {
        if (weather === null) continue;
        const meta = metaMap.get(key);
        if (!meta) continue;
        filtered.push({ ...weather, ...meta });
      }
      setWeatherPoints(filtered);
      return true;
    } catch (error) {
      console.error('Weather fetch failed:', error);
      setWeatherPoints([]);
      return false;
    }
  }, []);
```

- [ ] **Step 3: Update every `updateWeather` call site**

`handleFileUpload`:

```typescript
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const fileSizeKb = file.size / 1024;
      performance.mark('gpx-parse-start');
      const parsedRoute = await parseGPXAsync(text, dpEpsilon, dpMaxGap);
      performance.mark('gpx-parse-end');
      const measure = performance.measure('gpx-parse', 'gpx-parse-start', 'gpx-parse-end');
      console.log(`[gpx] parsed in ${measure.duration.toFixed(0)}ms (file: ${fileSizeKb.toFixed(1)}KB)`);
      appliedTechParamsRef.current = { dpEpsilon, dpMaxGap };
      setRawGpxContent(text);
      setRoute(parsedRoute);
      setRouteName(parsedRoute.name);
      setSavedRouteId(null);
      // A new GPX means the old checkpoint distances are meaningless — reset to
      // just the mandatory end checkpoint, seeded from the current Average Speed.
      const freshCheckpoints = defaultCheckpoints(parsedRoute.totalDistance, avgSpeed, startTime);
      setCheckpoints(freshCheckpoints);
      setWeatherLoading(true);
      const success = await updateWeather(parsedRoute, freshCheckpoints, startTime, selectedProvider);
      if (success) setLastFetchedParams({ avgSpeed, startTime, selectedProvider, checkpoints: freshCheckpoints });
    } catch (error) {
      console.error('Failed to parse GPX:', error);
      const message = error instanceof Error ? error.message : 'Failed to parse GPX file. Please ensure it is a valid track.';
      alert(message);
    } finally {
      setLoading(false);
      setWeatherLoading(false);
    }
  };
```

`loadRouteFromGpxText` (gains a `checkpoints` parameter — Task 11 threads it through every caller):

```typescript
  const loadRouteFromGpxText = useCallback(async (gpxContent: string, speed: number, start: Date, epsilon: number, maxGap: number, cps?: Checkpoint[]) => {
    setRawGpxContent(gpxContent);
    const parsedRoute = await parseGPXAsync(gpxContent, epsilon, maxGap);
    appliedTechParamsRef.current = { dpEpsilon: epsilon, dpMaxGap: maxGap };
    setRoute(parsedRoute);
    const resolvedCheckpoints = cps ?? defaultCheckpoints(parsedRoute.totalDistance, speed, start);
    setCheckpoints(resolvedCheckpoints);
    setWeatherLoading(true);
    try {
      const success = await updateWeather(parsedRoute, resolvedCheckpoints, start, selectedProvider);
      if (success) setLastFetchedParams({ avgSpeed: speed, startTime: start, selectedProvider, checkpoints: resolvedCheckpoints });
    } finally {
      setWeatherLoading(false);
    }
  }, [selectedProvider, updateWeather]);
```

`handleRefreshWeather`:

```typescript
  const handleRefreshWeather = useCallback(async () => {
    if (!route) return;
    setWeatherLoading(true);
    try {
      const success = await updateWeather(route, checkpoints, startTime, selectedProvider);
      if (success) setLastFetchedParams({ avgSpeed, startTime, selectedProvider, checkpoints });
    } finally {
      setWeatherLoading(false);
    }
  }, [route, checkpoints, avgSpeed, startTime, selectedProvider, updateWeather]);
```

`applyTechParams`:

```typescript
  const applyTechParams = useCallback(async (epsilon: number, maxGap: number) => {
    if (!route || !rawGpxContent || techCommitInFlightRef.current) return;
    const applied = appliedTechParamsRef.current;
    if (applied && applied.dpEpsilon === epsilon && applied.dpMaxGap === maxGap) return;

    techCommitInFlightRef.current = true;
    try {
      performance.mark('gpx-reparse-start');
      const parsedRoute = await parseGPXAsync(rawGpxContent, epsilon, maxGap);
      performance.mark('gpx-reparse-end');
      const measure = performance.measure('gpx-reparse', 'gpx-reparse-start', 'gpx-reparse-end');
      console.log(`[gpx] re-parsed in ${measure.duration.toFixed(0)}ms`);
      appliedTechParamsRef.current = { dpEpsilon: epsilon, dpMaxGap: maxGap };
      setRoute(parsedRoute);
      setHoveredIndex(null);
      setHoveredPoint(null);
      setHoveredData(null);
      setWeatherLoading(true);
      const params = lastFetchedParams ?? { avgSpeed, startTime, selectedProvider, checkpoints };
      try {
        const success = await updateWeather(parsedRoute, params.checkpoints, params.startTime, params.selectedProvider);
        if (success) setLastFetchedParams(params);
      } finally {
        setWeatherLoading(false);
      }
    } finally {
      techCommitInFlightRef.current = false;
    }
  }, [route, rawGpxContent, lastFetchedParams, avgSpeed, startTime, selectedProvider, checkpoints, updateWeather]);
```

Update the `chartData` call site (drop `avgSpeed`/`weatherAvgSpeed`, add `checkpoints`/`weatherCheckpoints`):

```typescript
  const chartData = useWeatherChartData({
    route,
    weatherPoints,
    chartWidth,
    startTime,
    checkpoints,
    weatherStartTime: lastFetchedParams?.startTime,
    weatherCheckpoints: lastFetchedParams?.checkpoints,
  });
```

- [ ] **Step 4: Run the full frontend test suite**

```bash
cd /workspace/frontend && npx vitest run
```

Expected: PASS. This is the riskiest step in the whole plan — `App.test.tsx` has ~35 existing tests exercising `avgSpeed`/`startTime`/dirty-flag/refresh flows; none of their assertions should change (a lone `end` checkpoint reproduces the old constant-speed formula exactly), but if any fail, read the failure closely: it almost always means a call site still passes the old `speed` argument to `updateWeather` or `loadRouteFromGpxText` without threading `checkpoints`/`cps` through — grep `updateWeather(` and `loadRouteFromGpxText(` in `App.tsx` to confirm every call site was updated per Step 3.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): wire checkpoint-based arrival times into App state"
```

---

## Task 11: `App.tsx` — render the checkpoint UI

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `CheckpointTrackRow` (Tasks 7-8), `impliedSpeedKmh`/`fullSequence` (Task 7), the `checkpoints` state and `loadRouteFromGpxText(..., cps?)` signature (Task 10).
- Produces: the rendered "Checkpoints" sidebar panel and track row — the last piece needed for a user to actually see and use this feature.

- [ ] **Step 1: Write the failing test for the real checkpoint-edit interaction**

Replace Task 10's placeholder test with a real one, using the `CheckpointTrackRow` stub's captured `onChange` (mirroring how the existing `ElevationChart` stub captures `onHoverIndex` — see `capturedHoverCb` near the top of `App.test.tsx`). Update the `CheckpointTrackRow` mock to capture its props:

```typescript
let capturedOnCheckpointsChange: ((next: unknown[]) => void) | null = null;

vi.mock('./components/CheckpointTrackRow', () => ({
  CheckpointTrackRow: ({ onChange }: { onChange: (next: unknown[]) => void }) => {
    capturedOnCheckpointsChange = onChange;
    return <div data-testid="checkpoint-track-row" />;
  },
}));
```

Add the real test (replacing Task 10's placeholder):

```typescript
  it('editing checkpoints marks the ride dirty and shows the Refresh button', async () => {
    render(<App />);
    const fileInput = screen.getByLabelText(/upload gpx/i, { selector: 'input' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(['<gpx/>'], 'route.gpx')] } });
    });
    await waitFor(() => screen.getByTestId('checkpoint-track-row'));
    expect(screen.queryByText('Refresh')).not.toBeInTheDocument();

    await act(async () => {
      capturedOnCheckpointsChange?.([
        { id: 'end', distanceM: 1000, arrivalTime: new Date('2026-01-01T09:00:00Z'), pinned: true },
      ]);
    });

    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /workspace/frontend && npx vitest run src/App.test.tsx
```

Expected: FAIL — `CheckpointTrackRow` isn't rendered in `App.tsx` yet, so `capturedOnCheckpointsChange` stays `null`.

- [ ] **Step 3: Implement — render the track row**

Import at the top of `App.tsx`:

```typescript
import { CheckpointTrackRow } from './components/CheckpointTrackRow';
import { buildSequence, impliedSpeedKmh } from './utils/speedProfile';
```

(`buildSequence`/`impliedSpeedKmh` come from the shared `speedProfile.ts` utility from Task 4, not from `CheckpointTrackRow` — that component's own internal sequence helper is private to its rendering needs, per Task 7's note.)

Pass `effectiveCheckpoints` (Task 10's `useMemo`-derived, auto-tracked view of `checkpoints` — see Task 10's fix-round note; NOT the raw `checkpoints` state) to `<ElevationChart>` (Task 5 added this prop — `startTime` is deliberately not one of `ElevationChart`'s props; `CheckpointOverlay` never needed it):

```tsx
                    <ElevationChart
                      data={elevationData}
                      climbs={climbs}
                      onHoverIndex={onHoverIndex}
                      onResize={setChartWidth}
                      hoveredIndex={hoveredIndex}
                      checkpoints={effectiveCheckpoints}
                    />
```

Insert the track row between the elevation chart and the wind row. It reads the auto-tracked `effectiveCheckpoints` for display, but writes back through the raw `setCheckpoints` — the component's own edits (add/drag/delete/change-time) always operate on the base state, never the derived view:

```tsx
                  <div className="border-t border-base-200" style={{ height: 30 }}>
                    <CheckpointTrackRow
                      checkpoints={effectiveCheckpoints}
                      startTime={startTime}
                      totalDistanceM={route.totalDistance}
                      distanceRange={distanceRange}
                      chartWidth={chartWidth}
                      onChange={setCheckpoints}
                    />
                  </div>
                  <div className="border-t border-base-200" style={{ height: 40 }}>
                    <WindArrowRow
```

- [ ] **Step 4: Run to verify the interaction test passes**

```bash
cd /workspace/frontend && npx vitest run src/App.test.tsx
```

Expected: PASS on the new test. If other existing tests newly fail because `screen.getByTestId('checkpoint-track-row')` now exists alongside other stubbed rows and something queries too broadly, check for accidental duplicate `data-testid` values — there should be none, since `CheckpointTrackRow`, `WindArrowRow`, and `PrecipBarRow` each stub to a distinct `data-testid`.

- [ ] **Step 5: Add the "Checkpoints" sidebar panel (test first)**

Add a test:

```typescript
  it('shows a Checkpoints panel listing each checkpoint\'s time after a route loads', async () => {
    render(<App />);
    const fileInput = screen.getByLabelText(/upload gpx/i, { selector: 'input' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(['<gpx/>'], 'route.gpx')] } });
    });
    await waitFor(() => screen.getByTestId('checkpoint-track-row'));
    fireEvent.click(screen.getByText('Checkpoints'));
    expect(screen.getByText(/finish/i)).toBeInTheDocument();
  });
```

Run it — expect FAIL (no such panel exists).

Add `'checkpoints'` to the `activePanel` union type and insert the panel in `App.tsx`, right after the "Ride Details" `</div>` (`App.tsx:540`) and before the Save/Share block:

```typescript
  const [activePanel, setActivePanel] = useState<'ride' | 'checkpoints' | 'routes' | 'tech' | null>('ride');
```

```tsx
          {/* Checkpoints */}
          {route && (
            <div className={`collapse collapse-arrow bg-base-100 shadow rounded-none border-x border-b border-base-300 ${activePanel === 'checkpoints' ? 'collapse-open' : ''}`}>
              <div
                className="collapse-title font-medium cursor-pointer"
                onClick={() => setActivePanel(p => p === 'checkpoints' ? null : 'checkpoints')}
              >
                Checkpoints
              </div>
              <div className="collapse-content flex flex-col gap-1.5">
                {buildSequence(startTime, effectiveCheckpoints).map((p, i, seq) => {
                  const label = i === 0 ? 'Start' : i === seq.length - 1 ? 'Finish' : `CP ${i}`;
                  const speed = i > 0 ? impliedSpeedKmh(seq[i - 1], p) : null;
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{label} · {(p.distanceM / 1000).toFixed(1)} km</span>
                      <span className="font-mono">
                        {p.arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {speed !== null && <span className="text-base-content/50 text-xs ml-1">({Math.round(speed)} km/h)</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
```

- [ ] **Step 6: Run to verify pass**

```bash
cd /workspace/frontend && npx vitest run src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Thread `checkpoints` through the share-link and localStorage-mount effects**

These read a route's stored checkpoints (once Task 12 adds `checkpointsJson` to `StoredRoute` and the share response) — for now, since Task 12 hasn't landed yet, pass `undefined` explicitly at both call sites so `loadRouteFromGpxText` falls back to `defaultCheckpoints` (its documented behavior from Task 10):

Share-link effect:

```typescript
          loadRouteFromGpxText(data.gpxContent as string, speed, start, dpEpsilon, dpMaxGap, undefined);
```

localStorage mount effect:

```typescript
        loadRouteFromGpxText(stored.gpxContent, stored.avgSpeedKmh, start, epsilon, maxGap, undefined)
          .catch(() => clearStoredRoute());
```

(Both call sites already exist at `App.tsx:329` and `App.tsx:347` respectively — this step only appends the sixth argument; Task 12 will replace `undefined` with parsed real values.)

- [ ] **Step 8: Run full suite and commit**

```bash
cd /workspace/frontend && npx vitest run
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): render checkpoint track row and sidebar panel"
```

---

## Task 12: `routeStorage.ts` — persist checkpoints to localStorage

**Files:**
- Modify: `frontend/src/services/routeStorage.ts`
- Modify: `frontend/src/services/routeStorage.test.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `Checkpoint` (Task 4).
- Produces: `StoredRoute.checkpointsJson?: string`.

- [ ] **Step 1: Write the failing test**

Add to `routeStorage.test.ts`:

```typescript
  it('round-trips checkpointsJson when present', () => {
    saveStoredRoute({ ...sampleRoute, checkpointsJson: '[{"id":"end","distanceM":1000}]' });
    expect(loadStoredRoute()).toEqual({ ...sampleRoute, checkpointsJson: '[{"id":"end","distanceM":1000}]' });
  });
```

Run `npx vitest run src/services/routeStorage.test.ts` — expect PASS actually, since `StoredRoute` is a plain interface and `saveStoredRoute`/`loadStoredRoute` just `JSON.stringify`/`parse` the whole object generically — the field will round-trip even before the type is declared, because TypeScript's structural typing doesn't add a runtime check. To make this a genuine red-green step, first add a **type-level** assertion that would fail to compile without the field:

```typescript
import type { StoredRoute } from './routeStorage';

it('StoredRoute type includes checkpointsJson', () => {
  const withCheckpoints: StoredRoute = { ...sampleRoute, checkpointsJson: '[]' };
  expect(withCheckpoints.checkpointsJson).toBe('[]');
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /workspace/frontend && npx vitest run src/services/routeStorage.test.ts
```

Expected: FAIL — TypeScript compile error, `checkpointsJson` does not exist on `StoredRoute`.

- [ ] **Step 3: Implement**

```typescript
export interface StoredRoute {
  name: string;
  gpxContent: string;
  avgSpeedKmh: number;
  startTime: string;
  id?: string;
  dpEpsilonMeters?: number;
  dpMaxGapMeters?: number;
  checkpointsJson?: string;
}
```

- [ ] **Step 4: Run to verify pass**

```bash
cd /workspace/frontend && npx vitest run src/services/routeStorage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire into `App.tsx`'s mirror effect and mount-time restore**

Update the mirror effect (`App.tsx:356-368`):

```typescript
  React.useEffect(() => {
    if (isViewingShared) return;
    if (!route || !rawGpxContent) return;
    saveStoredRoute({
      name: routeName,
      gpxContent: rawGpxContent,
      avgSpeedKmh: avgSpeed,
      startTime: startTime.toISOString(),
      id: savedRouteId ?? undefined,
      dpEpsilonMeters: dpEpsilon,
      dpMaxGapMeters: dpMaxGap,
      checkpointsJson: JSON.stringify(checkpoints),
    });
  }, [route, rawGpxContent, avgSpeed, startTime, isViewingShared, routeName, savedRouteId, dpEpsilon, dpMaxGap, checkpoints]);
```

Update the mount-time restore (`App.tsx:334-350`) to parse and pass it through, replacing the `undefined` from Task 11 Step 7:

```typescript
      const stored = loadStoredRoute();
      if (stored) {
        const start = new Date(stored.startTime);
        const epsilon = stored.dpEpsilonMeters ?? DP_EPSILON_METERS;
        const maxGap = stored.dpMaxGapMeters ?? DP_MAX_GAP_METERS;
        const storedCheckpoints = stored.checkpointsJson ? parseCheckpointsJson(stored.checkpointsJson) : undefined;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount initialization from localStorage, not a prop-sync pattern
        setAvgSpeed(stored.avgSpeedKmh);
        setStartTime(start);
        setRouteName(stored.name);
        setSavedRouteId(stored.id ?? null);
        setDpEpsilon(epsilon);
        setDpMaxGap(maxGap);
        loadRouteFromGpxText(stored.gpxContent, stored.avgSpeedKmh, start, epsilon, maxGap, storedCheckpoints)
          .catch(() => clearStoredRoute());
      }
```

Add a small local helper near the top of `App.tsx` (dates need reviving — `JSON.parse` leaves `arrivalTime` as a string):

```typescript
function parseCheckpointsJson(json: string): Checkpoint[] {
  try {
    const raw = JSON.parse(json) as { id: string; distanceM: number; arrivalTime: string; pinned: boolean }[];
    return raw.map(cp => ({ ...cp, arrivalTime: new Date(cp.arrivalTime) }));
  } catch {
    return [];
  }
}
```

Also update the share-link effect (`App.tsx:318-333`) the same way, once the shared `Route` response includes `checkpointsJson` (it will, once Task 1's regenerated client lands — this is a data-availability change, not a code change beyond swapping the `undefined` placeholder from Task 11 Step 7):

```typescript
          const data = res.data;
          const speed = data.avgSpeedKmh as number;
          const start = new Date(data.startTime as string);
          const sharedCheckpoints = data.checkpointsJson ? parseCheckpointsJson(data.checkpointsJson as string) : undefined;
          setIsViewingShared(true);
          setAvgSpeed(speed);
          setStartTime(start);
          setRouteName(data.name as string);
          loadRouteFromGpxText(data.gpxContent as string, speed, start, dpEpsilon, dpMaxGap, sharedCheckpoints);
```

- [ ] **Step 6: Run the full frontend suite and commit**

```bash
cd /workspace/frontend && npx vitest run
git add frontend/src/services/routeStorage.ts frontend/src/services/routeStorage.test.ts frontend/src/App.tsx
git commit -m "feat(frontend): persist checkpoints to localStorage and restore on load"
```

---

## Task 13: `SaveRouteButton` + `MyRoutesPanel` — persist checkpoints to the backend

**Files:**
- Modify: `frontend/src/components/SaveRouteButton.tsx`
- Modify: `frontend/src/components/SaveRouteButton.test.tsx`
- Modify: `frontend/src/components/MyRoutesPanel.tsx`
- Modify: `frontend/src/components/MyRoutesPanel.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: the generated `CreateRouteRequest`/`UpdateRouteRequest`/`RouteListItem` TS types (Task 1), `parseCheckpointsJson` (Task 12).
- Produces: `SaveRouteButton`'s `routeData` prop gains `checkpointsJson`; `MyRoutesPanel`'s `onLoadRoute` callback gains a `checkpointsJson: string | undefined` parameter.

- [ ] **Step 1: Write the failing `SaveRouteButton` tests**

Update the shared `routeData` fixture in `SaveRouteButton.test.tsx`:

```typescript
const routeData = {
  gpxContent: '<gpx/>',
  avgSpeedKmh: 20,
  startTime: new Date().toISOString(),
  checkpointsJson: '[{"id":"end","distanceM":1000}]',
};
```

Update the two existing assertions that check the exact call payload:

```typescript
    await waitFor(() => {
      expect(mocks.createRoute).toHaveBeenCalledWith({ name: 'My Ride', ...routeData });
      ...
```

(no change needed here — the spread already carries `checkpointsJson` through once it's on the fixture)

```typescript
    await waitFor(() => {
      expect(mocks.updateRoute).toHaveBeenCalledWith('existing-id', {
        name: 'My Ride',
        avgSpeedKmh: routeData.avgSpeedKmh,
        startTime: routeData.startTime,
        checkpointsJson: routeData.checkpointsJson,
      });
      ...
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /workspace/frontend && npx vitest run src/components/SaveRouteButton.test.tsx
```

Expected: FAIL on the `updateRoute` assertion (current code only sends `name`/`avgSpeedKmh`/`startTime`).

- [ ] **Step 3: Implement**

In `SaveRouteButton.tsx`, update the `updateRoute` call:

```typescript
    if (savedRouteId && !saveAsNew) {
      const res = await routesApi.updateRoute(savedRouteId, {
        name,
        avgSpeedKmh: routeData.avgSpeedKmh,
        startTime: routeData.startTime,
        checkpointsJson: routeData.checkpointsJson,
      });
      onSaved(res.data.id as string);
    } else {
```

(`createRoute`'s call already spreads `...routeData`, so it needs no change — `checkpointsJson` flows through automatically once the caller includes it in `routeData`.)

- [ ] **Step 4: Run to verify pass**

```bash
cd /workspace/frontend && npx vitest run src/components/SaveRouteButton.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Wire `App.tsx`'s `<SaveRouteButton>` call site**

```tsx
                  <SaveRouteButton
                    isAuthenticated={isAuthenticated()}
                    name={routeName}
                    onNameChange={setRouteName}
                    routeData={{
                      gpxContent: rawGpxContent,
                      avgSpeedKmh: avgSpeed,
                      startTime: startTime.toISOString(),
                      checkpointsJson: JSON.stringify(checkpoints),
                    }}
                    savedRouteId={savedRouteId}
                    onSaved={(id) => { setSavedRouteId(id); setRoutesRefreshToken(t => t + 1) }}
                    onRequireAuth={() => setSignInOpen(true)}
                  />
```

- [ ] **Step 6: Write the failing `MyRoutesPanel` tests**

Update `MyRoutesPanel.test.tsx`'s `handleClick`/`onLoadRoute` test:

```typescript
  it('calls onLoadRoute with GPX, id, name, and checkpointsJson when route is clicked', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })
    mocks.getRoute.mockResolvedValue({ data: { ...sampleItems[0], gpxContent: '<gpx/>', checkpointsJson: '[{"id":"end","distanceM":1000}]' } })

    const onLoadRoute = vi.fn()
    render(<MyRoutesPanel onLoadRoute={onLoadRoute} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByText('Alpine Loop'))

    await waitFor(() => {
      expect(onLoadRoute).toHaveBeenCalledWith('<gpx/>', 18, '2026-06-17T08:00:00Z', 'uuid-1', 'Alpine Loop', '[{"id":"end","distanceM":1000}]')
    })
  })
```

Update the duplicate test:

```typescript
  it('duplicates a route with a "(copy)" suffix without loading it, and carries checkpointsJson over', async () => {
    const duplicatedItem = { ...sampleItems[0], id: 'uuid-2', name: 'Alpine Loop (copy)' }
    mocks.listRoutes
      .mockResolvedValueOnce({ data: sampleItems })
      .mockResolvedValueOnce({ data: [...sampleItems, duplicatedItem] })
    mocks.getRoute.mockResolvedValue({ data: { ...sampleItems[0], gpxContent: '<gpx/>', checkpointsJson: '[{"id":"end","distanceM":1000}]' } })
    mocks.createRoute.mockResolvedValue({ data: { id: 'uuid-2' } })

    const onLoadRoute = vi.fn()
    render(<MyRoutesPanel onLoadRoute={onLoadRoute} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByRole('button', { name: /duplicate alpine loop/i }))

    await waitFor(() => {
      expect(mocks.createRoute).toHaveBeenCalledWith({
        name: 'Alpine Loop (copy)',
        gpxContent: '<gpx/>',
        avgSpeedKmh: 18,
        startTime: '2026-06-17T08:00:00Z',
        checkpointsJson: '[{"id":"end","distanceM":1000}]',
      })
    })
    expect(onLoadRoute).not.toHaveBeenCalled()
    await screen.findByText('Alpine Loop (copy)')
  })
```

- [ ] **Step 7: Run to verify failure**

```bash
cd /workspace/frontend && npx vitest run src/components/MyRoutesPanel.test.tsx
```

Expected: FAIL on both updated tests.

- [ ] **Step 8: Implement**

In `MyRoutesPanel.tsx`, update the `Props` interface and both handlers:

```typescript
interface Props {
  onLoadRoute: (gpxContent: string, avgSpeedKmh: number, startTime: string, id: string, name: string, checkpointsJson?: string) => void
  onDeleted: (id: string) => void
  refreshKey?: string
}
```

```typescript
  async function handleClick(id: string, avgSpeedKmh: number, startTime: string, name: string) {
    const res = await routesApi.getRoute(id)
    onLoadRoute(res.data.gpxContent as string, avgSpeedKmh, startTime, id, name, res.data.checkpointsJson as string | undefined)
  }

  async function handleDuplicate(e: React.MouseEvent, id: string, name: string, avgSpeedKmh: number, startTime: string) {
    e.stopPropagation()
    const res = await routesApi.getRoute(id)
    await routesApi.createRoute({
      name: `${name} (copy)`,
      gpxContent: res.data.gpxContent as string,
      avgSpeedKmh,
      startTime,
      checkpointsJson: res.data.checkpointsJson as string | undefined,
    })
    await fetchRoutes()
  }
```

- [ ] **Step 9: Run to verify pass**

```bash
cd /workspace/frontend && npx vitest run src/components/MyRoutesPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Wire `App.tsx`'s `<MyRoutesPanel>` call site**

```tsx
                <MyRoutesPanel
                  onLoadRoute={(gpxContent, avgSpeedKmh, startTime, id, name, checkpointsJson) => {
                    const start = new Date(startTime)
                    setAvgSpeed(avgSpeedKmh)
                    setStartTime(start)
                    setRouteName(name)
                    setSavedRouteId(id)
                    loadRouteFromGpxText(
                      gpxContent, avgSpeedKmh, start, dpEpsilon, dpMaxGap,
                      checkpointsJson ? parseCheckpointsJson(checkpointsJson) : undefined,
                    )
                  }}
                  onDeleted={(id) => {
                    ...
```

- [ ] **Step 11: Run the full frontend suite and commit**

```bash
cd /workspace/frontend && npx vitest run
git add frontend/src/components/SaveRouteButton.tsx frontend/src/components/SaveRouteButton.test.tsx \
        frontend/src/components/MyRoutesPanel.tsx frontend/src/components/MyRoutesPanel.test.tsx \
        frontend/src/App.tsx
git commit -m "feat(frontend): save and restore checkpoints through the backend"
```

---

## Task 14: Playwright e2e coverage

**Files:**
- Modify: `frontend/tests/local-route-persistence.spec.ts`
- Modify: `frontend/tests/my-routes.spec.ts`

**Interfaces:**
- Exercises the full stack built by Tasks 1-13 through the browser.

- [ ] **Step 1: Read both existing spec files to match their fixture/helper conventions**

```bash
cd /workspace/frontend && sed -n '1,60p' tests/local-route-persistence.spec.ts
sed -n '1,60p' tests/my-routes.spec.ts
```

(No code to write for this step — read the output and use the same GPX-upload helper, selectors, and `test.describe` structure already established in these files for the two new tests below, rather than inventing new patterns.)

- [ ] **Step 2: Add a localStorage round-trip test**

Add to `local-route-persistence.spec.ts`, following its existing upload-then-reload pattern:

```typescript
test('a checkpoint added to the track survives a full page reload', async ({ page }) => {
  await uploadSampleGpx(page); // use this file's existing upload helper — check its exact name/signature in Step 1's output and match it
  const track = page.getByTestId('checkpoint-track-line'); // adjust to the real locator convention used elsewhere in this file if different (e.g. a data-testid or role-based query)
  const box = await track.boundingBox();
  if (!box) throw new Error('checkpoint track not found');
  await track.click({ position: { x: box.width * 0.4, y: box.height / 2 } });
  await page.getByRole('button', { name: /yes, add/i }).click();
  await page.getByRole('button', { name: /^save$/i }).click();

  await page.reload();

  await expect(page.locator('[data-checkpoint-marker][data-draggable="true"]')).toHaveCount(1);
});
```

- [ ] **Step 3: Add a backend round-trip test**

Add to `my-routes.spec.ts`, following its existing sign-in + save + reload-from-list pattern:

```typescript
test('a saved route\'s checkpoints are restored when reloaded from My Routes', async ({ page }) => {
  // Follow this file's existing sign-in and GPX-upload steps (see Step 1's output) up to
  // the point where a route is loaded and ready to save.
  const track = page.getByTestId('checkpoint-track-line');
  const box = await track.boundingBox();
  if (!box) throw new Error('checkpoint track not found');
  await track.click({ position: { x: box.width * 0.4, y: box.height / 2 } });
  await page.getByRole('button', { name: /yes, add/i }).click();
  await page.getByRole('button', { name: /^save$/i }).click();

  // Save the route (match this file's existing "Save route" flow, e.g. naming it and clicking Save).
  await page.getByLabel(/route name/i).fill('Checkpoint Test Route');
  await page.getByRole('button', { name: /save route/i }).click();

  await page.reload();

  // Match this file's existing "load from My Routes" flow.
  await page.getByRole('button', { name: 'My routes' }).click();
  await page.getByText('Checkpoint Test Route').click();

  await expect(page.locator('[data-checkpoint-marker][data-draggable="true"]')).toHaveCount(1);
});
```

- [ ] **Step 4: Run both specs**

```bash
cd /workspace/frontend && npx playwright test local-route-persistence.spec.ts my-routes.spec.ts
```

Expected: PASS. If selectors don't match (this plan's placeholders for "match this file's existing X flow" need resolving against the real file content read in Step 1), fix them to use the actual helpers/locators already in each file — do not invent a parallel selector convention.

- [ ] **Step 5: Commit**

```bash
git add frontend/tests/local-route-persistence.spec.ts frontend/tests/my-routes.spec.ts
git commit -m "test(e2e): cover checkpoint persistence across reload and save/load"
```

---

## Task 15: Full verification and PR

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend suite**

```bash
cd /workspace/backend && ./mvnw test
```

Expected: PASS.

- [ ] **Step 2: Run the full frontend suite, lint, and build**

```bash
cd /workspace/frontend && npx vitest run && npm run lint && npm run build
```

Expected: all PASS (the build step also type-checks, which will catch any remaining `avgSpeed`/`checkpoints` signature mismatches missed by Vitest's runtime mocks).

- [ ] **Step 3: Run the full Playwright suite**

```bash
cd /workspace/frontend && npx playwright test
```

Expected: PASS.

- [ ] **Step 4: Manually verify in a running dev server**

```bash
cd /workspace && make dev
```

Upload a GPX, open the new "Checkpoints" panel, click the track to add a checkpoint, drag it, right-click to change its time (verify the Shift/Keep cascade prompt appears when a downstream checkpoint exists), delete it, save the route, reload the page, and reload it again from "My routes" — confirm the checkpoint survives both paths. Stop the dev server when done.

- [ ] **Step 5: Push branch and open the PR**

```bash
git push -u origin HEAD
gh pr create --title "Add checkpoint-based arrival times (#38)" --body "$(cat <<'EOF'
## Summary
- Lets a user pin arrival times at points along the route (checkpoints); segment speed between them replaces the single constant Average Speed for weather-timing math.
- A checkpoint always exists at the route's end (fixed position, undeletable, time still editable) and at the start (driven by the existing Start Time field).
- Checkpoints persist with the route: a new `checkpoints_json` TEXT column on `routes`, mirrored to localStorage for the working-route cache.

## Test plan
- [x] `./mvnw test` (backend)
- [x] `npx vitest run` (frontend unit)
- [x] `npx playwright test` (e2e)
- [x] `npm run build` (type-check)
- [x] Manual pass: add/drag/change-time/delete a checkpoint; save and reload a route; reload via My Routes

Closes #38

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Mark the spec as viewed on the PR**

Per this repo's CLAUDE.md instructions:

```bash
PR_NUMBER=$(gh pr view --json number -q .number)
PR_ID=$(gh pr view "$PR_NUMBER" --json id -q .id)
gh api graphql -f query="
  mutation {
    markFileAsViewed(input: {pullRequestId: \"$PR_ID\", path: \"docs/superpowers/specs/2026-09-05-checkpoint-arrival-times-design.md\"}) {
      pullRequest { number }
    }
  }
"
```

Also commit the spec and plan files if they weren't already committed in an earlier task (they were created as standalone `Write`s during brainstorming/planning, outside this plan's task commits):

```bash
git add docs/superpowers/specs/2026-09-05-checkpoint-arrival-times-design.md \
        docs/superpowers/plans/2026-09-05-checkpoint-arrival-times.md
git commit -m "docs: add checkpoint arrival times spec and implementation plan"
git push
```

- [ ] **Step 7: Report the PR URL**

```bash
gh pr view --json url -q .url
```
