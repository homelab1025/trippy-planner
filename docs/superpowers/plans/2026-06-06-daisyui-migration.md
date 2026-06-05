# DaisyUI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hand-rolled UI component (accordion, buttons, inputs, panels) with DaisyUI v4 primitives, keeping all chart/map logic and layout structure intact.

**Architecture:** Add Tailwind CSS v3 + DaisyUI v4 to the build, set `data-theme="emerald"` on `<html>`, then replace CSS class names and structural divs in `App.tsx` and `HoverPane.tsx` with DaisyUI component classes. All existing unit tests pass without modification — they query by text and label, not by class name.

**Tech Stack:** Tailwind CSS v3, DaisyUI v4, Vite (PostCSS auto-detected), Vitest + Testing Library

---

## File map

| File | Action |
|---|---|
| `package.json` | Add `tailwindcss`, `autoprefixer`, `daisyui@4` to devDependencies |
| `tailwind.config.js` | Create — ESM, content scan, daisyui plugin, emerald theme |
| `postcss.config.js` | Create — tailwindcss + autoprefixer |
| `index.html` | Add `data-theme="emerald"` to `<html>` |
| `src/index.css` | Replace entirely: Tailwind directives + leaflet rule only |
| `src/App.tsx` | Remove App.css import; replace all className strings with Tailwind/DaisyUI |
| `src/App.css` | Delete |
| `src/components/HoverPane.tsx` | Replace CSS class names with Tailwind utilities |

---

### Task 1: Install Tailwind + DaisyUI and wire up the build

**Files:**
- Modify: `package.json` (via npm install)
- Create: `tailwind.config.js`
- Create: `postcss.config.js`

- [ ] **Step 1: Install packages**

```bash
npm install -D tailwindcss@3 autoprefixer daisyui@4
```

Expected: packages added to `node_modules` and `devDependencies` in `package.json`.

- [ ] **Step 2: Create `tailwind.config.js`**

The project uses `"type": "module"`, so use ESM syntax.

```js
import daisyui from 'daisyui';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [daisyui],
  daisyui: { themes: ['emerald'] },
};
```

- [ ] **Step 3: Create `postcss.config.js`**

Vite reads this automatically — no `vite.config.ts` change needed.

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Verify build succeeds**

```bash
npm run build
```

Expected: build completes without errors. DaisyUI CSS is now available but not yet used.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js postcss.config.js package.json package-lock.json
git commit -m "chore: add Tailwind CSS v3 + DaisyUI v4 to build"
```

---

### Task 2: Update HTML and CSS baseline

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Add `data-theme` to `index.html`**

Replace:
```html
<html lang="en">
```
With:
```html
<html lang="en" data-theme="emerald">
```

- [ ] **Step 2: Replace `src/index.css`**

Delete everything in the file and write:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Leaflet requires explicit dimensions — Vite's asset hashing breaks the default icon URLs */
.leaflet-container {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  z-index: 1;
}
```

The Google Fonts import, all `:root` custom properties, and all component CSS are removed. DaisyUI's `emerald` theme provides its own design tokens via CSS variables.

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: all tests pass. The CSS changes don't affect DOM structure or text content.

- [ ] **Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "chore: wire Tailwind directives and DaisyUI emerald theme"
```

---

### Task 3: App.tsx — outer shell, navbar, display area

**Files:**
- Modify: `src/App.tsx`

This task replaces the outermost layout divs and the header. `App.css` is NOT deleted yet — its import is removed here so old styles stop applying, but the file stays until Task 7.

- [ ] **Step 1: Remove the App.css import**

Delete line 18:
```ts
import './App.css';
```

- [ ] **Step 2: Replace the outer wrapper, navbar, and main grid**

Replace the entire `return (...)` block with the following. Props on `<MapComponent>`, `<ElevationChart>`, `<WeatherLineChart>`, and `<HoverPane>` are unchanged — copy them verbatim from the original.

```tsx
return (
  <div className="flex flex-col h-screen max-w-[1400px] mx-auto p-6 gap-6">

    {/* Navbar */}
    <div className="navbar bg-primary text-primary-content rounded-box shadow-lg px-4 flex-shrink-0">
      <div className="flex-none gap-3">
        <img src={logo} alt="Trippy Planner" className="w-10 h-10 rounded-full object-cover" />
        <h1 className="text-xl font-bold">Trippy Planner</h1>
      </div>
      {route && (
        <div className="flex-1 text-center text-sm opacity-90 px-4">
          {route.name}: {(route.totalDistance / 1000).toFixed(1)} km · {Math.round(route.totalElevationGain)} m of character-building
        </div>
      )}
      <div className="flex-none ml-auto">
        <label
          htmlFor="gpx-upload"
          className={`btn btn-sm btn-outline text-primary-content border-primary-content hover:bg-primary-content hover:text-primary gap-2 ${loading ? 'btn-disabled pointer-events-none' : ''}`}
        >
          {loading ? 'Processing...' : (
            <>
              <Upload size={16} />
              Upload GPX
            </>
          )}
        </label>
        <input id="gpx-upload" type="file" accept=".gpx" onChange={handleFileUpload} disabled={loading} className="hidden" />
      </div>
    </div>

    {/* Main grid */}
    <div className="grid lg:grid-cols-[320px_1fr] grid-cols-1 gap-6 flex-1 min-h-0">

      {/* ── Sidebar goes here (Task 4) ── */}

      {/* Display area */}
      <div className="flex flex-col gap-6 min-h-0">

        {/* Map card */}
        <div className="card bg-base-100 shadow flex-[2] min-h-0 overflow-hidden">
          {!route ? (
            <div className="flex flex-col items-center justify-center h-full text-base-content/40 gap-4">
              <MapIcon size={48} />
              <p>Upload a GPX file to see your route</p>
            </div>
          ) : (
            <MapComponent
              route={route}
              hoveredPoint={hoveredPoint}
              debugPins={weatherDebug ? weatherPoints.map(wp => ({ lat: wp.point.lat, lng: wp.point.lng, label: wp.label })) : undefined}
            />
          )}
        </div>

        {/* Elevation + hover pane card */}
        <div className="card bg-base-100 shadow flex-1 min-h-0 overflow-hidden p-5 flex">
          {!route ? (
            <div className="flex flex-col items-center justify-center flex-1 text-base-content/40 gap-4">
              <CloudRain size={32} />
              <p>Weather timeline will appear here</p>
            </div>
          ) : (
            <>
              <ElevationChart
                data={elevationData}
                totalDistance={route.totalDistance}
                climbs={climbs}
                avgSpeed={avgSpeed}
                startTime={startTime}
                xAxisMode={xAxisMode}
                onHoverIndex={onHoverIndex}
                onResize={setChartWidth}
                hoveredIndex={hoveredIndex}
              />
              <HoverPane hoveredData={hoveredData} xAxisMode={xAxisMode} startTime={startTime} />
            </>
          )}
        </div>

      </div>
    </div>
  </div>
);
```

Leave a comment placeholder `{/* ── Sidebar goes here (Task 4) ── */}` where the sidebar will go — it is added in the next task.

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: all tests pass. The sidebar is temporarily missing but tests that rely on it open it via click events.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: migrate App.tsx shell and display area to Tailwind + DaisyUI"
```

---

### Task 4: App.tsx — sidebar accordion

**Files:**
- Modify: `src/App.tsx`

Replace the `{/* ── Sidebar goes here (Task 4) ── */}` comment with the full sidebar. The three panels use DaisyUI `collapse` with `collapse-open` controlled by the existing `activePanel` state, preserving the programmatic panel-switching in `handleFileUpload`.

- [ ] **Step 1: Insert the sidebar**

Replace the placeholder comment with:

```tsx
{/* Sidebar — single-open accordion via collapse-open + activePanel state */}
<div className="flex flex-col overflow-y-auto">

  {/* Ride Details */}
  <div className={`collapse collapse-arrow bg-base-100 shadow rounded-b-none rounded-t-box border border-base-300 ${activePanel === 'ride' ? 'collapse-open' : ''}`}>
    <div
      className="collapse-title font-medium cursor-pointer"
      onClick={() => setActivePanel(p => p === 'ride' ? null : 'ride')}
    >
      Ride Details
    </div>
    <div className="collapse-content flex flex-col gap-3">

      <div className="form-control w-full">
        <label htmlFor="avg-speed" className="label pb-1">
          <span className="label-text">Average Speed (km/h)</span>
        </label>
        <input
          id="avg-speed"
          type="number"
          value={avgSpeed}
          onChange={(e) => setAvgSpeed(Number(e.target.value))}
          min="5"
          max="60"
          className="input input-bordered input-sm w-full"
        />
      </div>

      <div className="flex gap-2">
        <div className="form-control flex-1">
          <label htmlFor="start-date" className="label pb-1">
            <span className="label-text">Start Date</span>
          </label>
          <input
            id="start-date"
            type="date"
            value={getLocalDateString(startTime)}
            onChange={(e) => handleDateChange(e.target.value)}
            min={todayStr}
            max={maxDateStr}
            className="input input-bordered input-sm w-full"
          />
        </div>
        <div className="form-control flex-1">
          <label htmlFor="start-time" className="label pb-1">
            <span className="label-text">Start Time</span>
          </label>
          <input
            id="start-time"
            type="time"
            value={getLocalTimeString(startTime)}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="input input-bordered input-sm w-full"
          />
        </div>
      </div>

      <div>
        <div className="label-text text-sm mb-2">X Axis Mode</div>
        <div className="join">
          <button
            className={`btn btn-sm join-item ${xAxisMode === 'clock' ? 'btn-primary' : ''}`}
            onClick={() => setXAxisMode('clock')}
          >
            Clock
          </button>
          <button
            className={`btn btn-sm join-item ${xAxisMode === 'elapsed' ? 'btn-primary' : ''}`}
            onClick={() => setXAxisMode('elapsed')}
          >
            Elapsed
          </button>
        </div>
      </div>

    </div>
  </div>

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
        <>
          <div className="h-[180px] flex-shrink-0 overflow-hidden">
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
          <div className="h-[180px] flex-shrink-0 overflow-hidden mt-3">
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
        <p className="text-base-content/50 text-sm text-center py-2">
          Load a route to see weather
        </p>
      )}
    </div>
  </div>

  {/* Tech Details */}
  <div className={`collapse collapse-arrow bg-base-100 shadow rounded-t-none rounded-b-box border-x border-b border-base-300 ${activePanel === 'tech' ? 'collapse-open' : ''}`}>
    <div
      className="collapse-title font-medium cursor-pointer"
      onClick={() => setActivePanel(p => p === 'tech' ? null : 'tech')}
    >
      Tech Details
    </div>
    <div className="collapse-content flex flex-col gap-3">

      <div className="form-control w-full">
        <label htmlFor="dp-epsilon" className="label pb-1">
          <span className="label-text">DP Epsilon (m)</span>
        </label>
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
          className="input input-bordered input-sm w-full"
        />
      </div>

      <div className="form-control w-full">
        <label htmlFor="dp-max-gap" className="label pb-1">
          <span className="label-text">Max Gap (m)</span>
        </label>
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
          className="input input-bordered input-sm w-full"
        />
      </div>

      <div className="stats stats-vertical bg-base-200 shadow w-full">
        <div className="stat py-2 px-3">
          <div className="stat-title text-xs">Original Points</div>
          <div className="stat-value text-base">{route ? route.originalPointCount.toLocaleString() : '—'}</div>
        </div>
        <div className="stat py-2 px-3">
          <div className="stat-title text-xs">Map Points</div>
          <div className="stat-value text-base">{route ? route.points.length.toLocaleString() : '—'}</div>
        </div>
        <div className="stat py-2 px-3">
          <div className="stat-title text-xs">Parse time</div>
          <div className="stat-value text-base">{parseMetrics ? `${parseMetrics.totalMs.toFixed(0)} ms` : '—'}</div>
        </div>
        <div className="stat py-2 px-3">
          <div className="stat-title text-xs">File</div>
          <div className="stat-value text-base">{parseMetrics ? `${parseMetrics.fileSizeKb.toFixed(1)} KB` : '—'}</div>
        </div>
      </div>

      <div className="form-control w-full">
        <label htmlFor="weather-provider" className="label pb-1">
          <span className="label-text">Weather Provider</span>
        </label>
        <select
          id="weather-provider"
          value={selectedProvider.id}
          onChange={(e) => {
            const next = PROVIDERS.find(p => p.id === e.target.value && p.available);
            if (next) setSelectedProvider(next);
          }}
          className="select select-bordered select-sm w-full"
        >
          {PROVIDERS.map(p => (
            <option key={p.id} value={p.id} disabled={!p.available}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <label className="label cursor-pointer justify-start gap-3 p-0">
        <input
          id="weather-debug"
          type="checkbox"
          checked={weatherDebug}
          onChange={(e) => setWeatherDebugState(e.target.checked)}
          className="checkbox checkbox-primary checkbox-sm"
        />
        <span className="label-text">Weather debug</span>
      </label>

      <div className="divider my-0" />
      <div className="text-sm font-semibold">v{__APP_VERSION__}</div>
      <div className="text-xs text-base-content/50">{buildDate}</div>

    </div>
  </div>

</div>
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace sidebar glass panels with DaisyUI collapse accordion"
```

---

### Task 5: Update HoverPane.tsx

**Files:**
- Modify: `src/components/HoverPane.tsx`

- [ ] **Step 1: Replace the component with Tailwind utilities**

```tsx
import React from 'react';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { formatElapsed } from '../hooks/useWeatherChartData';

interface HoverPaneProps {
  hoveredData: ChartDataPoint | null;
  xAxisMode: 'clock' | 'elapsed';
  startTime: Date;
}

function HoverRow({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="grid grid-cols-[20px_1fr] gap-1 mb-1 items-center">
      <span className="text-center text-[0.8rem]">{icon}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
}

const HoverPane: React.FC<HoverPaneProps> = React.memo(({ hoveredData, xAxisMode, startTime }) => {
  if (!hoveredData) {
    return (
      <div className="w-[110px] flex-shrink-0 flex flex-col pl-2 text-xs border-l border-base-300 ml-2 items-center justify-center text-center text-base-content/40">
        <p>Hover over charts to see values here</p>
      </div>
    );
  }

  const timeStr = xAxisMode === 'clock'
    ? new Date(hoveredData.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : formatElapsed(hoveredData.time - startTime.getTime());

  return (
    <div className="w-[110px] flex-shrink-0 flex flex-col pl-2 text-xs border-l border-base-300 ml-2">
      <HoverRow icon="⏱" value={timeStr} />
      <HoverRow icon="→" value={`${hoveredData.distance.toFixed(1)} km`} />
      <HoverRow icon="↑" value={`${Math.round(hoveredData.elevation)} m`} />
      <HoverRow icon="🌡" value={hoveredData.temp != null ? `${Math.round(hoveredData.temp)}°C` : '—'} />
      <HoverRow icon="💨" value={hoveredData.windSpeed != null ? `${Math.round(hoveredData.windSpeed)} km/h` : '—'} />
      <HoverRow
        icon="🌧"
        value={hoveredData.precipProb != null
          ? `${Math.round(hoveredData.precipProb)}% · ${hoveredData.precipitation != null ? hoveredData.precipitation.toFixed(1) : '—'} mm`
          : '—'
        }
      />
    </div>
  );
});

export default HoverPane;
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: all HoverPane tests pass — they query by text content, not by class name.

- [ ] **Step 3: Commit**

```bash
git add src/components/HoverPane.tsx
git commit -m "feat: migrate HoverPane to Tailwind utilities"
```

---

### Task 6: Delete App.css and final verification

**Files:**
- Delete: `src/App.css`

- [ ] **Step 1: Delete App.css**

```bash
rm src/App.css
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass. No component imports App.css — it was removed from App.tsx in Task 3.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: build succeeds with no errors or warnings about missing files.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete App.css — fully replaced by Tailwind + DaisyUI"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Install tailwindcss, autoprefixer, daisyui@4 | Task 1 |
| Create tailwind.config.js (content, plugin, emerald theme) | Task 1 |
| Create postcss.config.js | Task 1 |
| `data-theme="emerald"` on `<html>`, no media query switching | Task 2 |
| index.css → Tailwind directives + leaflet rule only | Task 2 |
| Drop Google Fonts — use system font stack | Task 2 (font import removed entirely) |
| Delete App.css | Task 6 |
| Navbar replaces `.header` | Task 3 |
| `card bg-base-100 shadow` replaces `.glass-panel` on map + elevation containers | Task 3 |
| `collapse collapse-arrow + collapse-open` replaces accordion h3 onClick | Task 4 |
| `activePanel` state kept for programmatic panel switching | Task 4 |
| `form-control` + `input input-bordered` replaces `.input-group` | Task 4 |
| `join` + `btn btn-sm join-item btn-primary` replaces Clock/Elapsed toggles | Task 4 |
| `stats stats-vertical` replaces `.stats-grid` | Task 4 |
| `select select-bordered` + `checkbox checkbox-primary` | Task 4 |
| HoverPane CSS classes → Tailwind utilities | Task 5 |
| Tests pass without modification | verified in every task |
