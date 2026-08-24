# New UI Theme (query-param switchable)

## Goal

Add a second visual theme to the frontend, based on the design tokens in
`frontend/new-ui/DESIGN.md`, selectable via `?ui=new` in the URL. Functionality
is unchanged — this is a token-level reskin, not a restructuring of layout or
components. Without `?ui=new`, the app looks and behaves exactly as it does
today.

## Non-goals

- No restructuring toward the `new-ui/code.html` mockup's layout (fixed
  sidebar, top nav links, profile chip). That mockup is a differently-shaped
  reference page, not a spec for this app's layout — only its design tokens
  (colors, type, radius, shadows) are used.
- No persistence of the theme choice (no localStorage). The theme is
  determined purely by whether the current page load's URL has `?ui=new`.
- No adoption of Material Symbols icons or the full headline/body/label
  typographic scale — only the base font-family and daisyui token values
  are swapped.
- No new component tests beyond confirming the theme switch itself; existing
  behavior/tests for the default theme are unaffected.

## Mechanism

`daisyui` (already used pervasively via `bg-base-100`, `btn`, `card`,
`collapse`, etc., themed via `data-theme` on `<html>`) gets a second theme,
`alpine`, registered in `tailwind.config.js` next to the existing `emerald`
theme. `App.tsx` reads the query param once on mount and sets
`document.documentElement.dataset.theme` accordingly:

```ts
const isNewUi = new URLSearchParams(window.location.search).get('ui') === 'new';
// useEffect: document.documentElement.dataset.theme = isNewUi ? 'alpine' : 'emerald';
```

Because nearly every component already uses daisyui semantic classes instead
of hardcoded colors, no component JSX changes for the color/radius/shadow
swap — only the theme definition and the font/shadow CSS overrides scoped to
`[data-theme='alpine']`.

The exceptions are hardcoded hex colors passed as raw SVG/Leaflet props
(recharts elements, `Polyline`/`CircleMarker` colors) — daisyui can't theme
those. These are pulled into a small per-theme color table.

## Token mapping (`tailwind.config.js` → `daisyui.themes`)

New theme `alpine`, derived from `frontend/new-ui/DESIGN.md`'s front-matter:

| daisyui slot | value | source token |
|---|---|---|
| `primary` / `primary-content` | `#256a4e` / `#ffffff` | `primary` / `on-primary` |
| `secondary` / `secondary-content` | `#48663f` / `#ffffff` | `secondary` / `on-secondary` |
| `neutral` / `neutral-content` | `#2b3234` / `#ebf2f4` | `inverse-surface` / `inverse-on-surface` |
| `base-100` | `#ffffff` | `surface-container-lowest` |
| `base-200` | `#eef5f7` | `surface-container-low` |
| `base-300` | `#bfc9c1` | `outline-variant` (used as border color, e.g. `border-base-300`) |
| `base-content` | `#161d1f` | `on-surface` |
| `error` / `error-content` | `#ba1a1a` / `#ffffff` | `error` / `on-error` |
| `--rounded-box` | `0.75rem` | "Shapes": cards use 12px radius |
| `--rounded-btn` | `0.375rem` | "Shapes": buttons use 6px radius |

`info`, `success`, `warning`, `accent` are not defined in the token file and
are used sparingly (`badge-info`, `text-success`) — left at daisyui defaults
rather than inventing values.

## Typography

- Add the Hanken Grotesk Google Fonts `<link>` to `index.html` (unconditional
  — cheap to load, simpler than conditional injection).
- In `index.css`:
  ```css
  [data-theme='alpine'] {
    font-family: 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif;
  }
  ```
- JetBrains Mono is explicitly optional in the source doc ("may be used") —
  skipped to keep the diff minimal.

## Shadows

```css
[data-theme='alpine'] .shadow {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}
```
Scoped to the new theme only — the default theme's `shadow` usage is
untouched.

## Layout width

`App.tsx`'s root wrapper currently has `max-w-[1400px] mx-auto`. This becomes
conditional: dropped entirely when `isNewUi` is true (full window width, per
explicit instruction), kept as-is otherwise.

## Chart/map color retinting

New `frontend/src/theme/chartColors.ts` exports two palettes (`emerald`,
`alpine`) covering the hardcoded hex values in:
- `ElevationChart.tsx` (elevation gradient/line, axis strokes)
- `WindArrowRow.tsx` / `PrecipBarRow.tsx` (accent colors, gridlines)
- `MapComponent.tsx` (route polyline, hover/debug pin colors)
- `ClimbOverlay.tsx` (climb category colors Cat4→HC)

Each of these components selects its palette via the same `isNewUi` boolean
(threaded down as a prop from `App.tsx`, or read via a small
`useNewUiTheme()` hook to avoid prop drilling through unrelated components).

Colors not present in the M3 token file (climb category shades, wind/precip
blue accents) are derived to stay harmonious with the given palette rather
than invented arbitrarily: elevation gradient/polyline → primary green
(`#256a4e`); climb categories graduate toward tertiary ochre (`#8d4f01`) and
error coral (`#ba1a1a`) for the hardest climbs; wind/precip accents shift
toward the secondary sage/primary green family instead of the current
saturated blue, to stay in-palette.

## Testing

- Existing Vitest tests are unaffected (they exercise default-theme
  behavior, which is unchanged).
- Add Playwright coverage: `/?ui=new` results in `data-theme="alpine"` on
  `<html>` and no max-width constraint on the root container; loading
  without the param keeps `data-theme="emerald"` and the existing
  max-width.
