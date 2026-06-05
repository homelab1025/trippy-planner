---
name: daisyui-migration
description: Replace hand-rolled accordion, buttons, and inputs with DaisyUI v4 + Tailwind CSS, keeping layout intact and using the emerald theme with no browser-theme switching
metadata:
  type: project
---

# DaisyUI Migration

## Goal

Replace every hand-rolled UI component (accordion, buttons, inputs, panels) with DaisyUI v4 primitives. The page layout and all chart/map internals are unchanged. The result uses DaisyUI defaults with minimal customisation.

## Library choice

**DaisyUI v4** on top of **Tailwind CSS v3**, `emerald` theme hardcoded — no media-query or JS theme switching.

Rejected alternatives:
- **shadcn/ui** — also Tailwind-based and a closer fit, but copies component source into the repo which adds maintenance surface. DaisyUI's semantic class approach is simpler for this scope.
- **Radix UI (unstyled)** — best choice for preserving the existing glass aesthetic, but the user explicitly wants to move to library defaults rather than retain the current look.
- **MUI** — considered and rejected: Material Design opinion fights a custom aesthetic, Emotion CSS-in-JS adds complexity, bundle is ~100 KB heavier than DaisyUI for the same three component types.

## Build setup

```
npm install -D tailwindcss autoprefixer postcss daisyui@4
```

New files:

**`tailwind.config.js`**
```js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [require('daisyui')],
  daisyui: { themes: ['emerald'] },
};
```

**`postcss.config.js`**
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

`vite.config.ts` — no changes needed (Vite reads PostCSS config automatically).

## Theme

`data-theme="emerald"` is set on `<html>` in `index.html`. It is never changed at runtime. The `:root` custom property block in `index.css` (current design tokens) is deleted.

## CSS strategy

### `index.css` — keep only:
- `@tailwind base`, `@tailwind components`, `@tailwind utilities` directives
- ~~Google Fonts `@import`~~ — deleted. DaisyUI `emerald` uses the system font stack; custom fonts are out of scope for a "defaults" migration.
- The `.leaflet-container` rule (width/height/border-radius — Leaflet still needs this)

Everything else in `index.css` is deleted.

### `App.css` — deleted entirely.

Layout and all component styles move to Tailwind utility classes inline in JSX.

## Component mapping

### App shell (`App.tsx`)

| Removed | Replacement |
|---|---|
| `.app-container` | `flex flex-col h-screen max-w-[1400px] mx-auto p-6 gap-6` |
| `.header` | `navbar bg-primary text-primary-content rounded-box shadow-lg px-4 flex-shrink-0` |
| `.main-content` CSS grid | `grid grid-cols-[320px_1fr] gap-6 flex-1 min-h-0` |
| `.sidebar` + `.sidebar-scrollable` | `flex flex-col overflow-y-auto` |
| `.display-area` | `flex flex-col flex-1 gap-6 min-h-0` |
| `.glass-panel .map-container` | `card bg-base-100 shadow flex-[2] min-h-0 overflow-hidden` |
| `.glass-panel .elevation-row` | `card bg-base-100 shadow flex-1 min-h-0 p-5 flex` |
| `.empty-state` | `flex flex-col items-center justify-center h-full text-base-content/40 gap-4` |

### Sidebar accordion

The three `glass-panel` divs with `h3 onClick` become a stacked DaisyUI collapse group driven by `collapse-open`. **`activePanel` state is kept** because `handleFileUpload` programmatically switches to the Weather panel after a route loads — CSS-only radio inputs cannot be driven by JS.

Each panel uses the `collapse-open` class when its key matches `activePanel`, and clicking the title calls `setActivePanel`:

```tsx
<div className={`collapse collapse-arrow bg-base-100 shadow rounded-b-none rounded-t-box border border-base-300 ${activePanel === 'ride' ? 'collapse-open' : ''}`}>
  <div className="collapse-title font-medium" onClick={() => setActivePanel(p => p === 'ride' ? null : 'ride')}>
    Ride Details
  </div>
  <div className="collapse-content flex flex-col gap-3">
    {/* content always rendered, CSS controls visibility */}
  </div>
</div>
```

Middle panel: `rounded-none border-x border-b border-base-300`.
Bottom panel: `rounded-t-none rounded-b-box border-x border-b border-base-300`.

Content is always in the DOM (DaisyUI hides it via CSS `max-height`), so the route-conditional rendering inside the Weather panel becomes an inner conditional only.

### Interactive components

| Removed | Replacement |
|---|---|
| `label.btn-primary` (upload) | `label` + `className="btn btn-primary gap-2"` |
| Clock/Elapsed `<button>` pair | `<div className="join">` wrapping two `btn btn-sm join-item` buttons; active one adds `btn-primary` |
| `div.input-group` + bare `input` | `label.form-control` + `input input-bordered input-sm w-full` |
| `div.input-group` + `select` | `label.form-control` + `select select-bordered select-sm w-full` |
| `input[type=checkbox]` | `checkbox checkbox-primary checkbox-sm` |
| `.stats-grid` + `.stat-item` | `stats stats-vertical bg-base-200` with `stat` / `stat-title` / `stat-value` |
| `.glass-panel .weather-card` | `card bg-base-100 shadow` + `card-body p-4` |

### HoverPane (`HoverPane.tsx`)

| Removed | Replacement |
|---|---|
| `.hover-pane` | `w-[110px] flex-shrink-0 flex flex-col pl-2 text-xs border-l border-base-300 ml-2` |
| `.hover-pane--empty` | add `items-center justify-center text-center text-base-content/40` |
| `.hover-row` | `grid grid-cols-[20px_1fr] gap-1 mb-1 items-center` |
| `.hover-row-icon` | `text-center text-[0.8rem]` |
| `.hover-row-value` | `whitespace-nowrap` |

## What is not changed

- `MapComponent.tsx` — all internals unchanged; Leaflet CSS import stays in the component file
- `ElevationChart.tsx`, `WeatherLineChart.tsx`, `ClimbOverlay.tsx` — recharts internals unchanged
- All services, utils, workers, hooks
- `lucide-react` icon usage (DaisyUI has no icon system)

## Test impact

Tests asserting on CSS class names (`btn-primary`, `glass-panel`, `hover-pane`, etc.) must be updated to match the new DaisyUI class names. Logic and behaviour assertions are unaffected.

The `activePanel` state removal means any test that sets or reads `activePanel` must be updated.

## Out of scope

- Responsive / mobile layout changes
- Chart styling (recharts)
- Animation customisation beyond DaisyUI defaults
- Adding new components not already present in the app
