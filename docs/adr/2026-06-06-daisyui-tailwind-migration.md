# ADR: Migrate hand-rolled UI to DaisyUI v4 + Tailwind CSS

**Date:** 2026-06-06
**Status:** Accepted
**Related:** [design spec](../superpowers/specs/done/2026-06-06-daisyui-migration-design.md)

## Context

Every UI primitive — accordion, buttons, inputs, cards — was hand-rolled CSS
in `App.css`/`index.css` against a custom set of design tokens, with no
component library underneath.

## Decision

- Adopt **DaisyUI v4** on top of **Tailwind CSS v3**, with the `emerald`
  theme hardcoded via `data-theme="emerald"` on `<html>` — no media-query or
  JS-driven theme switching.
- `App.css` is deleted entirely; `index.css` is reduced to the three
  `@tailwind` directives plus the one rule that can't move to a utility
  class (`.leaflet-container` sizing, since Leaflet needs it).
- The sidebar accordion's `activePanel` state (introduced by the chart-split
  redesign) is kept rather than replaced by CSS-only radio-driven collapses,
  because `handleFileUpload` needs to programmatically switch to the Weather
  panel after a route loads, and CSS-only inputs can't be driven from JS.
- Chart internals (Recharts) and map internals (Leaflet) are explicitly out
  of scope and untouched.

## Alternatives considered

- **shadcn/ui** — also Tailwind-based and a closer visual fit, but rejected
  because it copies component source into the repo, adding more maintenance
  surface than DaisyUI's semantic-class approach.
- **Radix UI (unstyled)** — the best option for preserving the existing
  glass-panel aesthetic, but rejected because the explicit goal was to move
  to a library's own defaults rather than retain the current custom look.
- **MUI** — rejected: Material Design's opinionated look clashes with a
  custom aesthetic, Emotion CSS-in-JS adds complexity, and its bundle is
  roughly 100KB heavier than DaisyUI for the same three component types.

## Consequences

- Every test asserting on hand-rolled CSS class names (`btn-primary`,
  `glass-panel`, `hover-pane`, etc.) needed updating to the new DaisyUI class
  names; behavioral/logic assertions were unaffected.
- Custom fonts (the previous Google Fonts import) were dropped along with the
  rest of the custom design tokens — DaisyUI's `emerald` theme uses the
  system font stack, since preserving the old look was explicitly not a
  goal.
