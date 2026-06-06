# Weather Chart Relayout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the temperature + wind `WeatherLineChart` from the sidebar Weather accordion into the main card (between elevation and precipitation charts), and remove the Weather accordion entirely.

**Architecture:** All changes are confined to `src/App.tsx` and its test file. `WeatherLineChart` is reused unchanged with `hideAxes` at 80 px height — same treatment as the existing precipitation strip. The `setActivePanel('weather')` side-effect in `handleFileUpload` is removed since the Weather panel no longer exists.

**Tech Stack:** React, recharts (`WeatherLineChart`), Vitest + Testing Library

---

### Task 1: Set up isolated worktree and branch

**Files:**
- (no file edits)

- [ ] **Step 1: Create the git worktree**

From the repo root (`/Users/florin/oven/trippy-planner`):

```bash
git worktree add ../trippy-planner-weather-relayout -b feat/weather-chart-relayout
```

- [ ] **Step 2: Confirm the worktree was created**

```bash
git worktree list
```

Expected: two entries — the main worktree and the new one at `../trippy-planner-weather-relayout` on branch `feat/weather-chart-relayout`.

- [ ] **Step 3: All subsequent steps run from this directory**

```bash
cd ../trippy-planner-weather-relayout
```

---

### Task 2: Write failing tests

**Files:**
- Modify: `src/App.test.tsx`

Context: currently, `handleFileUpload` sets `activePanel` to `'weather'` after a successful upload, which collapses the Ride Details accordion. Five existing tests work around this by clicking "Ride Details" to re-open it before interacting with its inputs. After the implementation change (removing that `setActivePanel` call), Ride Details will stay open — those clicks become no-ops at best, and at worst close the panel.

- [ ] **Step 1: Remove the "re-open Ride Details" click from five tests**

In `src/App.test.tsx`, find and remove the following two-line block from each of these five tests:
- `'changing avg speed re-fetches weather and updates charts'`
- `'weather precipProb flows from service through chart data'`
- `'weather precipitation flows from service through chart data'`
- `'changing start date re-fetches weather and updates display'`
- `'Time Display toggle buttons are present and clickable'`

Remove from each:
```tsx
    // Ride Details collapses after upload — open it first
    fireEvent.click(screen.getByText('Ride Details'));
```

- [ ] **Step 2: Run tests to confirm the 5 modified tests now fail**

```bash
npx vitest run src/App.test.tsx
```

Expected: the 5 modified tests FAIL because Ride Details is currently closed after upload (inputs are hidden inside the collapsed accordion) and the clicks that used to re-open it are now gone. This confirms the tests correctly reflect the new behavior we're about to implement.

---

### Task 3: Implement the changes in `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Remove the `setActivePanel` switch in `handleFileUpload`**

Find this line inside `handleFileUpload` (inside the `try` block, after `setRoute`):

```tsx
      setActivePanel(p => (p === 'ride' || p === null) ? 'weather' : p);
```

Delete it. The try block should end with just `setRoute(parsedRoute);` followed by the parse metrics lines.

Full try block after the edit:
```tsx
    try {
      const text = await file.text();
      const fileSizeKb = file.size / 1024;
      performance.mark('gpx-parse-start');
      const parsedRoute = await parseGPXAsync(text, dpEpsilon, dpMaxGap);
      performance.mark('gpx-parse-end');
      const measure = performance.measure('gpx-parse', 'gpx-parse-start', 'gpx-parse-end');
      setParseMetrics({ totalMs: measure.duration, fileSizeKb });
      setRoute(parsedRoute);
    } catch (error) {
```

- [ ] **Step 2: Remove the Weather accordion from the sidebar**

Find and delete the entire `{/* Weather */}` block in the sidebar (the second `collapse` div):

```tsx
          {/* Weather */}
          <div className={`collapse collapse-arrow bg-base-100 shadow rounded-none border-x border-b border-base-300 ${activePanel === 'weather' ? 'collapse-open' : ''}`}>
            <div
              className="collapse-title font-medium cursor-pointer"
              onClick={() => setActivePanel(p => p === 'weather' ? null : 'weather')}
            >
              Weather
            </div>
            <div className="collapse-content">
              {route ? (
                <div className="h-[180px] flex-shrink-0 overflow-hidden">
                  <WeatherLineChart
                    data={tempWindData}
                    line1Config={TEMP_LINE}
                    line2Config={WIND_LINE}
                    hoveredIndex={hoveredIndex}
                    onHoverIndex={onHoverIndex}
                    weatherAvailable={weatherAvailable}
                  />
                </div>
              ) : (
                <p className="text-base-content/50 text-sm text-center py-2">
                  Load a route to see weather
                </p>
              )}
            </div>
          </div>
```

After removal, the Tech Details accordion directly follows Ride Details. Its existing `rounded-t-none rounded-b-box` classes are already correct for this position — no change needed.

- [ ] **Step 3: Insert the temp+wind strip into the main card**

Find the `elevation-row` div in the main card. It currently contains:

```tsx
                <div className="elevation-row flex flex-col flex-1 min-w-0">
                  <div style={{ height: 300 }}>
                    <ElevationChart
                      data={elevationData}
                      climbs={climbs}
                      onHoverIndex={onHoverIndex}
                      onResize={setChartWidth}
                      hoveredIndex={hoveredIndex}
                    />
                  </div>
                  <div className="border-t border-base-200" style={{ height: 80 }}>
                    <WeatherLineChart
                      data={precipData}
                      line1Config={PROB_LINE}
                      line2Config={AMOUNT_LINE}
                      hoveredIndex={hoveredIndex}
                      onHoverIndex={onHoverIndex}
                      weatherAvailable={weatherAvailable}
                      hideAxes
                    />
                  </div>
                </div>
```

Replace with:

```tsx
                <div className="elevation-row flex flex-col flex-1 min-w-0">
                  <div style={{ height: 300 }}>
                    <ElevationChart
                      data={elevationData}
                      climbs={climbs}
                      onHoverIndex={onHoverIndex}
                      onResize={setChartWidth}
                      hoveredIndex={hoveredIndex}
                    />
                  </div>
                  <div className="border-t border-base-200" style={{ height: 80 }}>
                    <WeatherLineChart
                      data={tempWindData}
                      line1Config={TEMP_LINE}
                      line2Config={WIND_LINE}
                      hoveredIndex={hoveredIndex}
                      onHoverIndex={onHoverIndex}
                      weatherAvailable={weatherAvailable}
                      hideAxes
                    />
                  </div>
                  <div className="border-t border-base-200" style={{ height: 80 }}>
                    <WeatherLineChart
                      data={precipData}
                      line1Config={PROB_LINE}
                      line2Config={AMOUNT_LINE}
                      hoveredIndex={hoveredIndex}
                      onHoverIndex={onHoverIndex}
                      weatherAvailable={weatherAvailable}
                      hideAxes
                    />
                  </div>
                </div>
```

---

### Task 4: Verify and commit

**Files:**
- (no edits)

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass, including the 5 modified ones.

- [ ] **Step 2: Run the linter**

```bash
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/App.test.tsx docs/superpowers/specs/2026-06-06-weather-chart-relayout-design.md docs/superpowers/plans/2026-06-06-weather-chart-relayout.md
git commit -m "feat: move temp+wind chart to main card, remove Weather sidebar accordion"
```
