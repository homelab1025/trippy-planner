# Sidebar Vertical Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current two-boolean accordion + pinned-bottom panel with a single-open vertical accordion (Ride Details → Weather → Tech Details) unified inside the scrollable sidebar.

**Architecture:** Replace `rideDetailsOpen`/`techDetailsOpen` state with a single `activePanel` discriminated union. Move Tech Details from the `sidebar-bottom` grid area into `sidebar-scrollable`. Add a Weather accordion panel containing the two `WeatherLineChart` components. After GPX upload, auto-open the Weather panel. Clean up CSS grid to reflect removal of row 2.

**Tech Stack:** React 19, TypeScript, hand-rolled CSS, Playwright E2E, Vitest unit tests

---

## File Map

| File | Change |
|------|--------|
| `src/App.tsx` | Replace 2 booleans with `activePanel` union; refactor sidebar JSX |
| `src/App.css` | Remove `.sidebar-bottom`; simplify grid; add `.weather-card`; strip chart container padding |
| `README.md` | Add TODO item for component library |

No new files. No test file changes (existing selectors remain valid after this refactor).

---

### Task 1: Replace accordion state with a single `activePanel` union

**Files:**
- Modify: `src/App.tsx:47-64`

- [ ] **Step 1: Replace the two boolean state declarations**

In `src/App.tsx`, find:
```tsx
const [techDetailsOpen, setTechDetailsOpen] = useState(false);
const [rideDetailsOpen, setRideDetailsOpen] = useState(true);
```
Replace with:
```tsx
const [activePanel, setActivePanel] = useState<'ride' | 'weather' | 'tech' | null>('ride');
```

- [ ] **Step 2: Update `handleFileUpload` to switch to the Weather panel on success**

In `src/App.tsx`, find inside `handleFileUpload`:
```tsx
      setRoute(parsedRoute);
      setRideDetailsOpen(false);
```
Replace with:
```tsx
      setRoute(parsedRoute);
      setActivePanel('weather');
```

- [ ] **Step 3: Run unit tests — verify no regressions before touching JSX**

```bash
npx vitest run
```
Expected: some tests fail because JSX still references the old state variables. That's fine — continue.

---

### Task 2: Refactor sidebar JSX — three accordion panels

**Files:**
- Modify: `src/App.tsx:229-465`

- [ ] **Step 1: Replace the entire `<aside className="sidebar">` block**

Find (starting at the `<aside className="sidebar">` open tag, ending at `</aside>`):
```tsx
        <aside className="sidebar">
          <div className="sidebar-scrollable">
            <div className="glass-panel control-card">
              <h3
                onClick={() => setRideDetailsOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: rideDetailsOpen ? '20px' : 0 }}
              >
                Ride Details
                {rideDetailsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </h3>
              {rideDetailsOpen && (
```

Replace the full `<aside>` block with:
```tsx
        <aside className="sidebar">
          <div className="sidebar-scrollable">
            <div className="glass-panel control-card">
              <h3
                onClick={() => setActivePanel(p => p === 'ride' ? null : 'ride')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: activePanel === 'ride' ? '20px' : 0 }}
              >
                Ride Details
                {activePanel === 'ride' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </h3>
              {activePanel === 'ride' && (
                <>
                  <div className="input-group">
                    <label htmlFor="avg-speed">Average Speed (km/h)</label>
                    <input
                      id="avg-speed"
                      type="number"
                      value={avgSpeed}
                      onChange={(e) => setAvgSpeed(Number(e.target.value))}
                      min="5"
                      max="60"
                    />
                  </div>
                  <div className="datetime-row">
                    <div className="input-group">
                      <label htmlFor="start-date">Start Date</label>
                      <input
                        id="start-date"
                        type="date"
                        value={getLocalDateString(startTime)}
                        onChange={(e) => handleDateChange(e.target.value)}
                        min={todayStr}
                        max={maxDateStr}
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="start-time">Start Time</label>
                      <input
                        id="start-time"
                        type="time"
                        value={getLocalTimeString(startTime)}
                        onChange={(e) => handleTimeChange(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    <button
                      className={xAxisMode === 'clock' ? 'btn-primary' : ''}
                      style={xAxisMode === 'clock'
                        ? { padding: '6px 16px', fontSize: '0.875rem' }
                        : { padding: '6px 16px', fontSize: '0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: '600' }
                      }
                      onClick={() => setXAxisMode('clock')}
                    >
                      Clock
                    </button>
                    <button
                      className={xAxisMode === 'elapsed' ? 'btn-primary' : ''}
                      style={xAxisMode === 'elapsed'
                        ? { padding: '6px 16px', fontSize: '0.875rem' }
                        : { padding: '6px 16px', fontSize: '0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: '600' }
                      }
                      onClick={() => setXAxisMode('elapsed')}
                    >
                      Elapsed
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="glass-panel weather-card">
              <h3
                onClick={() => setActivePanel(p => p === 'weather' ? null : 'weather')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: activePanel === 'weather' ? '12px' : 0 }}
              >
                Weather
                {activePanel === 'weather' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </h3>
              {activePanel === 'weather' && (
                route ? (
                  <>
                    <div className="tempwind-container">
                      <WeatherLineChart
                        data={tempWindData}
                        line1Config={TEMP_LINE}
                        line2Config={WIND_LINE}
                        xAxisMode={xAxisMode}
                        hoveredIndex={hoveredIndex}
                        onHoverIndex={onHoverIndex}
                        weatherAvailable={weatherAvailable}
                      />
                    </div>
                    <div className="precip-container" style={{ marginTop: '12px' }}>
                      <WeatherLineChart
                        data={precipData}
                        line1Config={PROB_LINE}
                        line2Config={AMOUNT_LINE}
                        xAxisMode={xAxisMode}
                        hoveredIndex={hoveredIndex}
                        onHoverIndex={onHoverIndex}
                        weatherAvailable={weatherAvailable}
                      />
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>
                    Load a route to see weather
                  </p>
                )
              )}
            </div>

            <div className="glass-panel stats-card tech-details-card">
              <h3
                onClick={() => setActivePanel(p => p === 'tech' ? null : 'tech')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: activePanel === 'tech' ? '20px' : 0 }}
              >
                Tech Details
                {activePanel === 'tech' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </h3>
              {activePanel === 'tech' && (
                <>
                  <div className="input-group">
                    <label htmlFor="dp-epsilon">DP Epsilon (m)</label>
                    <input
                      id="dp-epsilon"
                      type="number"
                      min="1"
                      step="1"
                      value={dpEpsilon}
                      disabled={route !== null}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) setDpEpsilon(Math.max(1, n));
                      }}
                    />
                  </div>
                  <div className="input-group" style={{ marginTop: '16px' }}>
                    <label htmlFor="dp-max-gap">Max Gap (m)</label>
                    <input
                      id="dp-max-gap"
                      type="number"
                      min="1"
                      step="10"
                      value={dpMaxGap}
                      disabled={route !== null}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) setDpMaxGap(Math.max(1, n));
                      }}
                    />
                  </div>
                  <div className="stats-grid" style={{ marginTop: '20px' }}>
                    <div className="stat-item">
                      <span className="stat-label">Original Points</span>
                      <span className="stat-value">{route ? route.originalPointCount.toLocaleString() : '—'}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Map Points</span>
                      <span className="stat-value">{route ? route.points.length.toLocaleString() : '—'}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Parse time</span>
                      <span className="stat-value">{parseMetrics ? `${parseMetrics.totalMs.toFixed(0)} ms` : '—'}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">File</span>
                      <span className="stat-value">{parseMetrics ? `${parseMetrics.fileSizeKb.toFixed(1)} KB` : '—'}</span>
                    </div>
                  </div>
                  <div className="input-group" style={{ marginTop: '16px' }}>
                    <label htmlFor="weather-provider">Weather Provider</label>
                    <select
                      id="weather-provider"
                      value={selectedProvider.id}
                      onChange={(e) => {
                        const next = PROVIDERS.find(p => p.id === e.target.value && p.available);
                        if (next) setSelectedProvider(next);
                      }}
                    >
                      {PROVIDERS.map(p => (
                        <option key={p.id} value={p.id} disabled={!p.available}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ marginTop: '16px', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                    <input
                      id="weather-debug"
                      type="checkbox"
                      checked={weatherDebug}
                      onChange={(e) => setWeatherDebugState(e.target.checked)}
                    />
                    <label htmlFor="weather-debug" style={{ marginBottom: 0, cursor: 'pointer' }}>Weather debug</label>
                  </div>
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <div className="build-info-version">v{__APP_VERSION__}</div>
                    <div className="build-info-meta">{buildDate}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
```

- [ ] **Step 2: Remove the `sidebar-bottom` div**

Find and delete this entire block (it comes after `</section>` for `display-area`):
```tsx
        <div className="sidebar-bottom">
          <div className="glass-panel stats-card tech-details-card">
            <h3
              onClick={() => setTechDetailsOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: techDetailsOpen ? '20px' : 0 }}
            >
              Tech Details
              {techDetailsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </h3>
            {techDetailsOpen && (
              <>
                ...entire content block...
              </>
            )}
          </div>
        </div>
```

- [ ] **Step 3: Run unit tests**

```bash
npx vitest run
```
Expected: all tests pass. If any fail, check that the `activePanel` references are correct and the `sidebar-bottom` div is fully removed.

---

### Task 3: Update CSS

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Remove `sidebar-bottom` grid row and simplify `main-content`**

Find:
```css
.main-content {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: 1fr auto;
  gap: 24px;
  flex: 1;
  min-height: 0;
}
```
Replace with:
```css
.main-content {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  gap: 24px;
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 2: Update `display-area` grid row span**

Find:
```css
.display-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 0;
  grid-column: 2;
  grid-row: 1 / 3;
}
```
Replace with:
```css
.display-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 0;
  grid-column: 2;
  grid-row: 1;
}
```

- [ ] **Step 3: Remove `.sidebar-bottom` CSS block**

Find and delete:
```css
.sidebar-bottom {
  grid-column: 1;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
```

- [ ] **Step 4: Add `.weather-card` styles and strip chart container padding**

Find:
```css
.tempwind-container,
.precip-container {
  height: var(--chart-sidebar-height);
  flex-shrink: 0;
  padding: 12px;
  overflow: hidden;
}
```
Replace with:
```css
.weather-card {
  padding: 16px 24px;
}

.weather-card h3 {
  font-size: 1.1rem;
}

.tempwind-container,
.precip-container {
  height: var(--chart-sidebar-height);
  flex-shrink: 0;
  overflow: hidden;
}
```

- [ ] **Step 5: Remove `.sidebar-bottom` from the mobile media query**

Find:
```css
  .sidebar,
  .display-area,
  .sidebar-bottom {
    grid-column: auto;
    grid-row: auto;
  }
```
Replace with:
```css
  .sidebar,
  .display-area {
    grid-column: auto;
    grid-row: auto;
  }
```

- [ ] **Step 6: Run unit tests and E2E tests**

```bash
npx vitest run
```
Expected: all pass.

```bash
npx playwright test
```
Expected: all pass. If `clock/elapsed toggle` or `changing speed` tests fail, verify Ride Details opens by default (`activePanel = 'ride'`) and that `.control-card h3` uniquely targets the Ride Details panel (Weather uses `.weather-card`, not `.control-card`).

---

### Task 4: Add README TODO

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add TODO entry for component library**

Find the `## TODO` section in `README.md`. Append this item to the existing TODO list:

```markdown
- **Replace hand-rolled UI components with a React component library.** The accordion, buttons, and inputs are currently hand-rolled with custom CSS. Replace with a component library (e.g. [shadcn/ui](https://ui.shadcn.com/) or [Radix UI](https://www.radix-ui.com/)) to gain accessibility, keyboard navigation, and animations for free.
```

- [ ] **Step 2: Run full test suite one final time**

```bash
npx vitest run && npx playwright test
```
Expected: all pass.

---

## Self-Review

**Spec coverage:**
- ✅ Single-open accordion with `activePanel` union state
- ✅ Three panels: Ride Details, Weather, Tech Details
- ✅ Weather panel shows placeholder when no route loaded
- ✅ Tech Details no longer pinned to bottom (`sidebar-bottom` removed)
- ✅ CSS grid simplified (row 2 removed)
- ✅ README TODO added

**Type consistency:**
- `activePanel` type is `'ride' | 'weather' | 'tech' | null` used consistently across all click handlers and conditional renders.
- `setActivePanel(p => p === 'X' ? null : 'X')` pattern used identically in all three panel headers.

**E2E test impact:**
- `.control-card h3` in the speed-change test uniquely targets Ride Details (Weather uses `.weather-card`, not `.control-card`). ✓
- `.tech-details-card h3` in Tech Details tests still works — class kept unchanged. ✓
- After upload, `activePanel = 'weather'` so `tempwind-chart` / `precip-chart` testids are present in the unit tests that `waitFor` them. ✓
- Tests that click `'Ride Details'` after upload work because `activePanel` is `'weather'` post-upload, not `'ride'`, so clicking Ride Details opens it (single-open: Weather closes). ✓
