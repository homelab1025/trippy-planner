# New UI Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `?ui=new` query-param-switchable second visual theme (colors, type, radius, shadows) to the frontend, with zero behavior change.

**Architecture:** Register a second `daisyui` theme (`alpine`) built from `frontend/new-ui/DESIGN.md`'s tokens, toggled via `data-theme` on `<html>` from a tiny `useNewUiTheme()` hook that reads `?ui=new` once per page load. Because the app already styles almost everything through daisyui semantic classes, no component restructuring is needed — only a handful of hardcoded SVG/Leaflet hex colors (chart lines, map markers) need a parallel small color-lookup table, `chartColors.ts`, keyed off the same hook.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3 + daisyui 4, recharts, react-leaflet, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-24-new-ui-theme-design.md`

## Global Constraints

- No persistence of the theme choice (no localStorage) — purely derived from the current page load's URL.
- No layout/component restructuring toward the `new-ui/code.html` mockup — token-level reskin only.
- No Material Symbols icon swap, no JetBrains Mono, no full headline/body/label type-scale rollout — base font-family swap only.
- Default (`emerald`) theme's appearance and behavior must be byte-for-byte unchanged when `?ui=new` is absent.
- Tooltip behavior contract (500ms hover delay, click/Enter/Space to open immediately, closes only after leaving both trigger and content) is unaffected — no tooltip logic is touched, only color tokens it already reads from daisyui (`bg-neutral`/`text-neutral-content`).

---

## File Structure

- `frontend/src/hooks/useNewUiTheme.ts` (new) — the single source of truth for "is the new theme active," a tiny hook wrapping `URLSearchParams`.
- `frontend/src/theme/chartColors.ts` (new) — the two hardcoded-color palettes (`emerald`, `alpine`) for recharts/Leaflet elements that daisyui can't theme, plus a `getChartPalette(isNewUi)` selector.
- `frontend/tailwind.config.js` (modify) — register the `alpine` daisyui theme.
- `frontend/index.html` (modify) — add the Hanken Grotesk Google Fonts link.
- `frontend/src/index.css` (modify) — scoped font-family and shadow overrides for `[data-theme='alpine']`.
- `frontend/src/App.tsx` (modify) — use the hook to set `data-theme` and toggle the root wrapper's max-width.
- `frontend/src/components/ElevationChart.tsx`, `ClimbOverlay.tsx`, `WindArrowRow.tsx`, `PrecipBarRow.tsx`, `MapComponent.tsx` (modify) — replace hardcoded hex colors with `getChartPalette(useNewUiTheme())` lookups.
- `frontend/tests/new-ui-theme.spec.ts` (new) — Playwright coverage of the query-param switch.

---

### Task 1: `useNewUiTheme` hook

**Files:**
- Create: `frontend/src/hooks/useNewUiTheme.ts`
- Test: `frontend/src/hooks/useNewUiTheme.test.ts`

**Interfaces:**
- Produces: `useNewUiTheme(): boolean` — a React hook returning `true` iff the current page's URL query string has `ui=new`. Used by Task 4 (App.tsx) and Tasks 5–7 (chart/map components).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/hooks/useNewUiTheme.test.ts
// @vitest-environment jsdom  — this project's default vitest environment is 'node';
// every other test file that touches `window` opts into jsdom this way per-file.
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNewUiTheme } from './useNewUiTheme';

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('useNewUiTheme', () => {
  it('returns false when there is no ui query param', () => {
    window.history.pushState({}, '', '/');
    const { result } = renderHook(() => useNewUiTheme());
    expect(result.current).toBe(false);
  });

  it('returns false when ui has an unrelated value', () => {
    window.history.pushState({}, '', '/?ui=old');
    const { result } = renderHook(() => useNewUiTheme());
    expect(result.current).toBe(false);
  });

  it('returns true when ui=new', () => {
    window.history.pushState({}, '', '/?ui=new');
    const { result } = renderHook(() => useNewUiTheme());
    expect(result.current).toBe(true);
  });

  it('returns true when ui=new is combined with other params', () => {
    window.history.pushState({}, '', '/?token=abc&ui=new');
    const { result } = renderHook(() => useNewUiTheme());
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/useNewUiTheme.test.ts`
Expected: FAIL — `Cannot find module './useNewUiTheme'`

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/hooks/useNewUiTheme.ts
import { useMemo } from 'react';

/**
 * True when the page was loaded with ?ui=new. Derived once per mount from
 * the URL — there is no persistence (no localStorage), so a reload without
 * the param reverts to the default theme.
 */
export function useNewUiTheme(): boolean {
  return useMemo(
    () => new URLSearchParams(window.location.search).get('ui') === 'new',
    []
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/useNewUiTheme.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/hooks/useNewUiTheme.ts src/hooks/useNewUiTheme.test.ts
git commit -m "feat(frontend): add useNewUiTheme hook for ?ui=new detection"
```

---

### Task 2: Chart/map color palette module

**Files:**
- Create: `frontend/src/theme/chartColors.ts`
- Test: `frontend/src/theme/chartColors.test.ts`

**Interfaces:**
- Consumes: `Climb['category']` type from `frontend/src/utils/climbDetector.ts` (already exists — exported union `'Cat4' | 'Cat3' | 'Cat2' | 'Cat1' | 'HC'`).
- Produces: `ChartPalette` interface and `getChartPalette(isNewUi: boolean): ChartPalette`, consumed by Tasks 5–7. `ChartPalette` fields: `elevationStroke`, `elevationGradient`, `gridStroke`, `axisStroke`, `tempStroke`, `hoverLine`, `hoverDot`, `routeLine`, `hoverMarker`, `debugPin`, `accentMuted`, `windBaseline`, `windAccent`, `precipBar`, `crosshair`, `popupText`, `climbCategory: Record<Climb['category'], string>` (all `string`, hex colors).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/theme/chartColors.test.ts
import { describe, it, expect } from 'vitest';
import { getChartPalette } from './chartColors';

describe('getChartPalette', () => {
  it('returns the current (emerald) palette when isNewUi is false', () => {
    const palette = getChartPalette(false);
    expect(palette.elevationStroke).toBe('#2d5a27');
    expect(palette.routeLine).toBe('#2d5a27');
    expect(palette.debugPin).toBe('#e53e3e');
    expect(palette.climbCategory.HC).toBe('#7B0099');
  });

  it('returns the alpine palette when isNewUi is true', () => {
    const palette = getChartPalette(true);
    expect(palette.elevationStroke).toBe('#256a4e');
    expect(palette.routeLine).toBe('#256a4e');
    expect(palette.debugPin).toBe('#ba1a1a');
    expect(palette.climbCategory.HC).toBe('#ba1a1a');
  });

  it('defines every climb category for both palettes', () => {
    const categories: Array<'Cat4' | 'Cat3' | 'Cat2' | 'Cat1' | 'HC'> = ['Cat4', 'Cat3', 'Cat2', 'Cat1', 'HC'];
    for (const isNewUi of [false, true]) {
      const palette = getChartPalette(isNewUi);
      for (const category of categories) {
        expect(palette.climbCategory[category]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/theme/chartColors.test.ts`
Expected: FAIL — `Cannot find module './chartColors'`

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/theme/chartColors.ts
import type { Climb } from '../utils/climbDetector';

export interface ChartPalette {
  elevationStroke: string;
  elevationGradient: string;
  gridStroke: string;
  axisStroke: string;
  tempStroke: string;
  hoverLine: string;
  hoverDot: string;
  routeLine: string;
  hoverMarker: string;
  debugPin: string;
  accentMuted: string;
  windBaseline: string;
  windAccent: string;
  precipBar: string;
  crosshair: string;
  popupText: string;
  climbCategory: Record<Climb['category'], string>;
}

// Current appearance — unchanged from what the components hardcoded before.
const emerald: ChartPalette = {
  elevationStroke: '#2d5a27',
  elevationGradient: '#2d5a27',
  gridStroke: '#eee',
  axisStroke: '#888',
  tempStroke: '#ff7300',
  hoverLine: '#aaa',
  hoverDot: '#2d5a27',
  routeLine: '#2d5a27',
  hoverMarker: '#FF6B00',
  debugPin: '#e53e3e',
  accentMuted: '#94a3b8',
  windBaseline: '#bfdbfe',
  windAccent: '#3b82f6',
  precipBar: '#3b82f6',
  crosshair: '#aaa',
  popupText: '#444',
  climbCategory: {
    Cat4: '#F5C518',
    Cat3: '#F5A623',
    Cat2: '#E8601C',
    Cat1: '#D0021B',
    HC: '#7B0099',
  },
};

// Derived from frontend/new-ui/DESIGN.md's token set (primary green, secondary
// sage, tertiary ochre, error coral, and the cool-gray neutrals).
const alpine: ChartPalette = {
  elevationStroke: '#256a4e',
  elevationGradient: '#256a4e',
  gridStroke: '#e2e9ec',
  axisStroke: '#707973',
  tempStroke: '#ea9a4e',
  hoverLine: '#707973',
  hoverDot: '#256a4e',
  routeLine: '#256a4e',
  hoverMarker: '#ea9a4e',
  debugPin: '#ba1a1a',
  accentMuted: '#707973',
  windBaseline: '#c7eab8',
  windAccent: '#48663f',
  precipBar: '#256a4e',
  crosshair: '#707973',
  popupText: '#161d1f',
  climbCategory: {
    Cat4: '#ADCF9F',
    Cat3: '#76BA99',
    Cat2: '#F2A154',
    Cat1: '#8d4f01',
    HC: '#ba1a1a',
  },
};

export function getChartPalette(isNewUi: boolean): ChartPalette {
  return isNewUi ? alpine : emerald;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/theme/chartColors.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/theme/chartColors.ts src/theme/chartColors.test.ts
git commit -m "feat(frontend): add chartColors palette for emerald/alpine themes"
```

---

### Task 3: Register the `alpine` daisyui theme, fonts, and shadow override

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a `data-theme="alpine"` daisyui theme selectable on `<html>` (consumed by Task 4), plus global CSS scoped under `[data-theme='alpine']` for font-family and `.shadow`.

This task has no unit test (it's config/CSS, not logic) — it's verified visually by the Playwright test in Task 8 and by the build step below.

- [ ] **Step 1: Register the theme in `tailwind.config.js`**

Read the current file first (`frontend/tailwind.config.js`), then change:

```js
import daisyui from 'daisyui';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [daisyui],
  daisyui: { themes: ['emerald'] },
};
```

to:

```js
import daisyui from 'daisyui';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [daisyui],
  daisyui: {
    themes: [
      'emerald',
      {
        alpine: {
          primary: '#256a4e',
          'primary-content': '#ffffff',
          secondary: '#48663f',
          'secondary-content': '#ffffff',
          neutral: '#2b3234',
          'neutral-content': '#ebf2f4',
          'base-100': '#ffffff',
          'base-200': '#eef5f7',
          'base-300': '#bfc9c1',
          'base-content': '#161d1f',
          error: '#ba1a1a',
          'error-content': '#ffffff',
          '--rounded-box': '0.75rem',
          '--rounded-btn': '0.375rem',
        },
      },
    ],
  },
};
```

- [ ] **Step 2: Add the Hanken Grotesk font link to `index.html`**

Read `frontend/index.html` first, then add inside `<head>`, after the existing `<meta name="viewport">` line and before `</head>`:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 3: Add scoped font-family and shadow overrides to `index.css`**

Read `frontend/src/index.css` first, then append at the end of the file:

```css

[data-theme='alpine'] {
  font-family: 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif;
}

[data-theme='alpine'] .shadow {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}
```

- [ ] **Step 4: Verify the app still builds and the default theme is unaffected**

Run: `cd frontend && npm run build`
Expected: build succeeds with no type or lint errors.

Run: `cd frontend && npm run dev` (in background) then open `http://localhost:5173/` in a browser (or `curl -s http://localhost:5173/ | grep data-theme`) and confirm `<html data-theme="emerald">` still renders by default — the new theme is registered but not yet wired to the query param (that's Task 4), so nothing user-visible changes yet.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add tailwind.config.js index.html src/index.css
git commit -m "feat(frontend): register alpine daisyui theme, fonts, shadow override"
```

---

### Task 4: Wire `App.tsx` to the theme

**Files:**
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `useNewUiTheme(): boolean` from Task 1 (`frontend/src/hooks/useNewUiTheme.ts`).

- [ ] **Step 1: Read the existing App.tsx and App.test.tsx**

Read `frontend/src/App.tsx` (root JSX is at the bottom, the `return` starting `<div className="flex flex-col h-screen overflow-y-auto max-w-[1400px] mx-auto p-3 sm:p-6 gap-4 sm:gap-6">`) and `frontend/src/App.test.tsx`. The file mocks `./auth` with `isAuthenticated: vi.fn(() => false)` at module scope, so a plain `render(<App />)` never calls `authApi.getMe()` and needs no extra per-test setup; `versionApi.getVersion` also has a default resolved mock. `window.history.pushState`/`replaceState` is already used by other describe blocks in this file (e.g. `describe('token landing', ...)`) to control the URL per test.

- [ ] **Step 2: Write the failing test**

Add a new `describe('new UI theme', ...)` block to `frontend/src/App.test.tsx`, placed after the closing `});` of the existing `describe('App', ...)` block (i.e. right before `describe('token landing', ...)`), so it doesn't disturb that block's assumption of a clean starting URL:

```ts
describe('new UI theme', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
    document.documentElement.removeAttribute('data-theme');
    cleanup();
  });

  it('sets data-theme to alpine and drops the max-width wrapper when ?ui=new', async () => {
    window.history.pushState({}, '', '/?ui=new');
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('alpine'));
    expect(document.querySelector('.max-w-\\[1400px\\]')).not.toBeInTheDocument();
  });

  it('sets data-theme to emerald and keeps the max-width wrapper without the param', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('emerald'));
    expect(document.querySelector('.max-w-\\[1400px\\]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/App.test.tsx -t "new UI theme"`
Expected: FAIL — `data-theme` is never set to `alpine`/`emerald` and the max-width class doesn't toggle (App currently always renders `max-w-[1400px]` and never touches `data-theme`).

- [ ] **Step 4: Implement**

In `frontend/src/App.tsx`:

1. Add the import near the other hook imports:
```ts
import { useNewUiTheme } from './hooks/useNewUiTheme';
```

2. Inside `function App() {`, right after the existing `useState`/`useMemo` declarations (before the `return`), add:
```ts
const isNewUi = useNewUiTheme();

React.useEffect(() => {
  document.documentElement.dataset.theme = isNewUi ? 'alpine' : 'emerald';
}, [isNewUi]);
```

3. Change the root wrapper's `className` from:
```tsx
<div className="flex flex-col h-screen overflow-y-auto max-w-[1400px] mx-auto p-3 sm:p-6 gap-4 sm:gap-6">
```
to:
```tsx
<div className={`flex flex-col h-screen overflow-y-auto ${isNewUi ? 'w-full' : 'max-w-[1400px] mx-auto'} p-3 sm:p-6 gap-4 sm:gap-6`}>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: PASS — including the pre-existing App tests (nothing else in the file should regress).

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/App.tsx src/App.test.tsx
git commit -m "feat(frontend): wire ?ui=new to alpine theme and full-width layout"
```

---

### Task 5: Retint `ElevationChart.tsx` and `ClimbOverlay.tsx`

**Files:**
- Modify: `frontend/src/components/ElevationChart.tsx`
- Modify: `frontend/src/components/ClimbOverlay.tsx`
- Test: `frontend/src/components/ElevationChart.test.tsx` (existing file — extend)

**Interfaces:**
- Consumes: `useNewUiTheme()` (Task 1), `getChartPalette(isNewUi)` / `ChartPalette` (Task 2).

`ClimbOverlay.tsx` has no dedicated test file today (it's mocked away entirely in `ElevationChart.test.tsx` via `vi.mock('./ClimbOverlay', ...)`, and its rendering depends on recharts context hooks — `useXAxisScale`, `useYAxisScale`, `usePlotArea` — that aren't trivial to mount standalone). Its color changes are covered by TypeScript (the `Record<Climb['category'], string>` type on `palette.climbCategory` means a missing/mistyped category fails `npm run build`), not by a new unit test — consistent with its current zero test coverage.

- [ ] **Step 1: Read the existing files**

Read `frontend/src/components/ElevationChart.tsx`, `frontend/src/components/ClimbOverlay.tsx`, and `frontend/src/components/ElevationChart.test.tsx`. Note that `ElevationChart.test.tsx` mocks the whole `recharts` module — `Area`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `ReferenceLine` currently render `null` or a bare `<div data-testid=...>` that does **not** forward `stroke`/`fill` props, while `ReferenceDot` forwards `x`/`y` only. The `<defs><linearGradient id="colorEle"><stop stopColor=.../></linearGradient></defs>` block in `ElevationChart.tsx`, however, is plain SVG JSX (not imported from `recharts`), so it renders for real in jsdom and needs no mock changes.

- [ ] **Step 2: Extend the mock and write the failing test**

In `frontend/src/components/ElevationChart.test.tsx`, change the `ReferenceDot` mock line from:

```ts
  ReferenceDot: ({ x, y }: { x: number; y: number }) => <div data-testid="reference-dot" data-x={x} data-y={y} />,
```

to:

```ts
  ReferenceDot: ({ x, y, fill }: { x: number; y: number; fill?: string }) => (
    <div data-testid="reference-dot" data-x={x} data-y={y} data-fill={fill} />
  ),
```

Then add:

```ts
it('uses the alpine palette elevation colors when ?ui=new', () => {
  window.history.pushState({}, '', '/?ui=new');
  const { container } = render(<ElevationChart {...defaultProps} hoveredIndex={1} />);
  const stop = container.querySelector('#colorEle stop');
  expect(stop).toHaveAttribute('stop-color', '#256a4e');
  expect(screen.getByTestId('reference-dot')).toHaveAttribute('data-fill', '#256a4e');
  window.history.pushState({}, '', '/');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/ElevationChart.test.tsx`
Expected: FAIL — both assertions see the current hardcoded `#2d5a27` regardless of the URL (confirm the mock change alone doesn't break the pre-existing reference-dot tests, which don't assert on `data-fill`).

- [ ] **Step 4: Implement**

In `frontend/src/components/ElevationChart.tsx`:
1. Add imports:
```ts
import { useNewUiTheme } from '../hooks/useNewUiTheme';
import { getChartPalette } from '../theme/chartColors';
```
2. Inside the `ElevationChart` component, before the `return`:
```ts
const palette = getChartPalette(useNewUiTheme());
```
3. Replace each hardcoded hex with the matching palette field:
   - both `<stop stopColor="#2d5a27" .../>` → `palette.elevationGradient`
   - `<CartesianGrid ... stroke="#eee" />` → `palette.gridStroke`
   - `<XAxis ... stroke="#888" />` → `palette.axisStroke`
   - `<YAxis yAxisId="elevation" ... stroke="#888" />` → `palette.axisStroke`
   - `<YAxis yAxisId="temp" ... stroke="#ff7300" />` → `palette.tempStroke`
   - `<Area ... stroke="#2d5a27" />` → `palette.elevationStroke`
   - `<Line ... stroke="#ff7300" />` → `palette.tempStroke`
   - `<ReferenceLine ... stroke="#aaa" .../>` → `palette.hoverLine`
   - `<ReferenceDot ... fill="#2d5a27" .../>` → `palette.hoverDot`

In `frontend/src/components/ClimbOverlay.tsx`:
1. Add imports:
```ts
import { useNewUiTheme } from '../hooks/useNewUiTheme';
import { getChartPalette } from '../theme/chartColors';
```
2. Inside the `ClimbOverlay` component, before the early-return `if (!xScale ...)`:
```ts
const palette = getChartPalette(useNewUiTheme());
```
3. Delete the module-level `CATEGORY_COLORS` constant (lines 10–16) and replace every `CATEGORY_COLORS[cr.category]` reference with `palette.climbCategory[cr.category]` (there are 4 usages: the gradient stops, the fill rect isn't colored directly but the polyline stroke, the badge rect fill, and the pole line stroke — check each).
4. Replace the popup `<text ... fill="#444">` with `fill={palette.popupText}`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/ElevationChart.test.tsx`
Expected: PASS, including all pre-existing tests in the file.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/components/ElevationChart.tsx src/components/ElevationChart.test.tsx src/components/ClimbOverlay.tsx
git commit -m "feat(frontend): retint elevation chart and climb overlay for alpine theme"
```

---

### Task 6: Retint `WindArrowRow.tsx` and `PrecipBarRow.tsx`

**Files:**
- Modify: `frontend/src/components/WindArrowRow.tsx`
- Modify: `frontend/src/components/PrecipBarRow.tsx`
- Test: `frontend/src/components/WindArrowRow.test.tsx` (existing — extend)
- Test: `frontend/src/components/PrecipBarRow.test.tsx` (existing — extend)

**Interfaces:**
- Consumes: `useNewUiTheme()` (Task 1), `getChartPalette(isNewUi)` (Task 2).

- [ ] **Step 1: Read the existing files**

Read `frontend/src/components/WindArrowRow.tsx` and `PrecipBarRow.tsx`. Both existing test files already define a local `makeSample(...)` helper building a full `ChartDataPoint` — reuse it rather than constructing ad hoc objects.

- [ ] **Step 2: Write the failing tests**

Add to `frontend/src/components/WindArrowRow.test.tsx` (reusing the file's existing `makeSample` helper):

```ts
it('uses the alpine palette wind accent color when ?ui=new', () => {
  window.history.pushState({}, '', '/?ui=new');
  const { container } = render(
    <WindArrowRow samplePoints={[makeSample(5, 10, 90)]} distanceRange={[0, 10]} chartWidth={800} />
  );
  const arrowLine = container.querySelector('g[data-arrow] line');
  expect(arrowLine).toHaveAttribute('stroke', '#48663f');
  window.history.pushState({}, '', '/');
});
```

Add to `frontend/src/components/PrecipBarRow.test.tsx` (reusing the file's existing `makeSample` helper):

```ts
it('uses the alpine palette precip bar color when ?ui=new', () => {
  window.history.pushState({}, '', '/?ui=new');
  const { container } = render(
    <PrecipBarRow samplePoints={[makeSample(5, 60, 1)]} distanceRange={[0, 10]} chartWidth={800} />
  );
  const rects = container.querySelectorAll('rect');
  rects.forEach(rect => expect(rect).toHaveAttribute('fill', '#256a4e'));
  window.history.pushState({}, '', '/');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/WindArrowRow.test.tsx src/components/PrecipBarRow.test.tsx`
Expected: FAIL — colors are still the hardcoded blues regardless of the URL.

- [ ] **Step 4: Implement**

In `frontend/src/components/WindArrowRow.tsx`:
1. Add imports and, inside the component before its early `if (!samplePoints.length...)` return:
```ts
import { useNewUiTheme } from '../hooks/useNewUiTheme';
import { getChartPalette } from '../theme/chartColors';
// ...
const palette = getChartPalette(useNewUiTheme());
```
   (`useNewUiTheme()` must be called before the early return, since hooks can't run conditionally — move the palette lookup above the `if` guard.)
2. Replace: icon wrapper `color: '#94a3b8'` → `color: palette.accentMuted`; baseline `<line stroke="#bfdbfe" ...>` → `palette.windBaseline`; arrow `<line stroke="#3b82f6">` and `<polyline stroke="#3b82f6">` → `palette.windAccent`; label `<text fill="#3b82f6">` → `palette.windAccent`; hover `<line stroke="#aaa">` → `palette.crosshair`.

In `frontend/src/components/PrecipBarRow.tsx`:
1. Same import/hook pattern, palette lookup moved above the early `if (!samplePoints.length...)` return.
2. Replace: icon wrapper `color: '#94a3b8'` → `palette.accentMuted`; `<rect fill="#3b82f6">` → `palette.precipBar`; hover `<line stroke="#aaa">` → `palette.crosshair`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/WindArrowRow.test.tsx src/components/PrecipBarRow.test.tsx`
Expected: PASS, including pre-existing tests in both files.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/components/WindArrowRow.tsx src/components/WindArrowRow.test.tsx src/components/PrecipBarRow.tsx src/components/PrecipBarRow.test.tsx
git commit -m "feat(frontend): retint wind/precip rows for alpine theme"
```

---

### Task 7: Retint `MapComponent.tsx`

**Files:**
- Modify: `frontend/src/components/MapComponent.tsx`
- Test: `frontend/src/components/MapComponent.test.tsx` (existing — extend)

**Interfaces:**
- Consumes: `useNewUiTheme()` (Task 1), `getChartPalette(isNewUi)` (Task 2).

- [ ] **Step 1: Read the existing files**

Read `frontend/src/components/MapComponent.tsx` and `MapComponent.test.tsx`. The test file mocks `react-leaflet`: `Polyline` currently renders `() => null` (its props aren't captured), and `CircleMarker` renders a `<div data-testid="circle-marker" data-lat=... data-lng=...>` (props partially captured). Both mocks need to capture color props too.

- [ ] **Step 2: Update the mocks and write the failing test**

In `frontend/src/components/MapComponent.test.tsx`, change the `react-leaflet` mock's `Polyline` and `CircleMarker` entries from:

```ts
  Polyline: () => null,
  CircleMarker: ({ center }: { center: [number, number] }) => (
    <div data-testid="circle-marker" data-lat={center[0]} data-lng={center[1]} />
  ),
```

to:

```ts
  Polyline: ({ color }: { color: string }) => (
    <div data-testid="polyline" data-color={color} />
  ),
  CircleMarker: ({ center, pathOptions }: { center: [number, number]; pathOptions?: { fillColor?: string } }) => (
    <div data-testid="circle-marker" data-lat={center[0]} data-lng={center[1]} data-fill-color={pathOptions?.fillColor} />
  ),
```

Then add:

```ts
it('uses the alpine palette route and marker colors when ?ui=new', () => {
  window.history.pushState({}, '', '/?ui=new');
  const { container } = render(
    <MapComponent
      route={mockRoute}
      hoveredPoint={{ lat: 48.005, lng: 2.005 }}
      debugPins={[{ lat: 48.0, lng: 2.0, label: 'A' }]}
    />
  );
  expect(container.querySelector('[data-testid="polyline"]')).toHaveAttribute('data-color', '#256a4e');
  const markers = container.querySelectorAll('[data-testid="circle-marker"]');
  expect(markers[0]).toHaveAttribute('data-fill-color', '#ea9a4e'); // hover marker (outer)
  expect(markers[2]).toHaveAttribute('data-fill-color', '#ba1a1a'); // debug pin
  window.history.pushState({}, '', '/');
});
```

(`Tooltip` from `react-leaflet` is also used for debug pins — it isn't mocked yet, since no prior test rendered `debugPins`; add `Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>` to the mock so this test doesn't throw on the unmocked export. Query markers via `container.querySelectorAll`, not `screen.getAllByTestId` — this file has no `afterEach(cleanup)`, so unmounted DOM from earlier tests in the same file lingers in `document.body` and would shift indices in a global query.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/MapComponent.test.tsx`
Expected: FAIL — the route/marker colors are still the hardcoded emerald-theme hex values regardless of the URL (and confirm the pre-existing 3 tests still pass against the updated mocks).

- [ ] **Step 4: Implement**

In `frontend/src/components/MapComponent.tsx`:
1. Add imports and, inside `MapComponent` before the `return`:
```ts
import { useNewUiTheme } from '../hooks/useNewUiTheme';
import { getChartPalette } from '../theme/chartColors';
// ...
const palette = getChartPalette(useNewUiTheme());
```
2. Replace: `<Polyline ... color="#2d5a27" .../>` → `color={palette.routeLine}`; both hovered-point `<CircleMarker>` `fillColor: '#FF6B00'` → `palette.hoverMarker`; debug pin `<CircleMarker>` `fillColor: '#e53e3e'` → `palette.debugPin`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/MapComponent.test.tsx`
Expected: PASS, including pre-existing tests in the file.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/components/MapComponent.tsx src/components/MapComponent.test.tsx
git commit -m "feat(frontend): retint map route/markers for alpine theme"
```

---

### Task 8: Playwright end-to-end coverage

**Files:**
- Create: `frontend/tests/new-ui-theme.spec.ts`

**Interfaces:**
- Consumes: nothing new — exercises the running app through the browser, same pattern as `frontend/tests/app.spec.ts`.

- [ ] **Step 1: Read the existing spec for conventions**

Read `frontend/tests/app.spec.ts` (already read above: `page.goto('/')`, `page.getByText(...)`, `page.locator(...)`) to match style.

- [ ] **Step 2: Write the test**

```ts
// frontend/tests/new-ui-theme.spec.ts
import { test, expect } from '@playwright/test';

test('default theme has no ui param: emerald theme, constrained width', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'emerald');
  await expect(page.locator('.max-w-\\[1400px\\]')).toBeVisible();
});

test('?ui=new switches to the alpine theme, full width', async ({ page }) => {
  await page.goto('/?ui=new');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'alpine');
  await expect(page.locator('.max-w-\\[1400px\\]')).toHaveCount(0);
  // Sanity check the app is still fully functional under the new theme.
  await expect(page.getByText('Upload GPX')).toBeVisible();
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');
});
```

- [ ] **Step 3: Run it**

Run: `cd frontend && npx playwright test tests/new-ui-theme.spec.ts`
Expected: both tests PASS (dev server auto-starts per `playwright.config.ts`'s `webServer`).

- [ ] **Step 4: Commit**

```bash
cd frontend && git add tests/new-ui-theme.spec.ts
git commit -m "test(frontend): add e2e coverage for ?ui=new theme switch"
```

---

### Task 9: Full verification, spec/design assets, and PR

**Files:**
- Add: `frontend/new-ui/` (the design source: `DESIGN.md`, `code.html`, `screen.png` — already present in the working tree, untracked)
- Add: `docs/superpowers/specs/2026-08-24-new-ui-theme-design.md` (already written)

**Interfaces:** none — this is a verification and delivery task, not a code task.

- [ ] **Step 1: Run the full frontend verification suite**

```bash
cd frontend && npm run lint && npm run build && npx vitest run && npx playwright test
```
Expected: all four commands succeed with no failures.

- [ ] **Step 2: Stage the design source and spec alongside the code changes**

```bash
git add frontend/new-ui/ docs/superpowers/specs/2026-08-24-new-ui-theme-design.md
git status
```
Confirm only intended files are staged (the unrelated pre-existing untracked file `docs/superpowers/specs/2026-08-20-component-diagram-overlay-design.md` must NOT be included — it belongs to different, unrelated work).

- [ ] **Step 3: Commit the design source and spec**

```bash
git commit -m "docs(frontend): add new-ui design source and theme spec"
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --title "Add ?ui=new alpine theme" --body "$(cat <<'EOF'
## Summary
- Adds a second daisyui theme (`alpine`), built from `frontend/new-ui/DESIGN.md`'s design tokens, selectable via `?ui=new` in the URL — no persistence, no functional change.
- Retints the handful of hardcoded chart/map SVG colors (elevation chart, climb overlay, wind/precip rows, map route/markers) that daisyui can't theme, via a small `chartColors.ts` palette keyed off the same query param.
- New theme renders full window width; default theme is pixel-for-pixel unchanged.

## Test plan
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npx vitest run`
- [ ] `npx playwright test`
- [ ] Manual: `/?ui=new` shows the alpine palette full-width; `/` is unchanged
EOF
)"
```

- [ ] **Step 5: Mark the spec as viewed on the PR**

Per this repo's CLAUDE.md convention:

```bash
PR_NUMBER=$(gh pr view --json number -q .number)
PR_ID=$(gh pr view "$PR_NUMBER" --json id -q .id)
gh api graphql -f query="
  mutation {
    markFileAsViewed(input: {pullRequestId: \"$PR_ID\", path: \"docs/superpowers/specs/2026-08-24-new-ui-theme-design.md\"}) {
      pullRequest { number }
    }
  }
"
```

Report the PR URL back to the user.
