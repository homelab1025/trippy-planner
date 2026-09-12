# ADR: Ship the alpine reskin behind a URL flag, then collapse to a single theme

**Date:** 2026-09-01
**Status:** Accepted
**Related:** [FDR: Alpine Explorer visual redesign](../fdr/2026-09-01-alpine-visual-redesign.md), [design spec](../superpowers/specs/2026-08-24-new-ui-theme-design.md)

## Context

A visual redesign ("Alpine Explorer") needed to be tried without disrupting
the existing look for every user while it was being validated. `daisyui`
(already used pervasively via semantic classes like `bg-base-100`, `btn`,
`card`, themed through `data-theme` on `<html>`) already supported multiple
registered themes, but a handful of hardcoded hex colors passed as raw
SVG/Leaflet props (recharts elements, `Polyline`/`CircleMarker` colors)
sit outside daisyui's reach and needed their own per-theme switch.

## Decision

- Add a second daisyui theme, `alpine`, registered in `tailwind.config.js`
  next to the existing `emerald`, driven by design tokens sourced from
  `frontend/new-ui/DESIGN.md`.
- Gate it behind a URL flag: `useNewUiTheme()` reads `?ui=new` once per
  mount (no persistence — a reload without the param reverts to emerald)
  and sets `document.documentElement.dataset.theme` accordingly, also
  switching between a max-width-1400px centered layout and a full-width one.
- Pull the theme-dependent raw hex colors daisyui can't reach into a small
  `getChartPalette(isNewUi)` lookup table (`frontend/src/theme/chartColors.ts`),
  consumed by `MapComponent`, `ElevationChart`, `ClimbOverlay`,
  `WindArrowRow`, and `PrecipBarRow`.
- Once the redesign was validated, collapse to a single theme: delete the
  `emerald` palette, `useNewUiTheme`, the `?ui=new` flag, and the
  constrained/full-width layout branch — `alpine` becomes the only
  `data-theme`, set statically in `index.html`, and `chartColors.ts`
  exports a single flat `chartPalette` instead of a lookup keyed by theme.

## Consequences

- The theme-keyed `getChartPalette`/dual-registration abstraction was
  temporary by design and was fully removed in the same feature's final
  commit, not left behind as dead code — anyone extending chart colors now
  edits one flat `chartPalette`, not a two-theme lookup.
- Because most components already used daisyui semantic classes, the
  reskin touched almost no component JSX directly — only theme
  registration, font/shadow CSS scoped to `[data-theme='alpine']`, and the
  small hardcoded-color tables. Removing the flag later was correspondingly
  small (one commit, ~180 lines net removed).
