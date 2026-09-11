# FDR: Alpine Explorer visual redesign

**Date:** 2026-09-01
**Status:** Shipped
**Related:** [ADR: Ship the alpine reskin behind a URL flag, then collapse to a single theme](../adr/2026-09-01-alpine-theme-collapse.md), [design spec](../superpowers/specs/2026-08-24-new-ui-theme-design.md)

## Problem

The app's look ("emerald" daisyui theme, centered 1400px layout) needed a
visual refresh — a token-level reskin ("Alpine Explorer": new green/earth
palette, Hanken Grotesk font, softer shadows, full-width layout) — without
changing any functionality or restructuring the layout.

## Decision (highlights)

- New color palette, font (Hanken Grotesk, loaded via Google Fonts), and
  softer box-shadow applied app-wide via a new daisyui theme, plus a small
  chart-specific color table for the map polyline/markers and chart
  elements that daisyui's theming can't reach.
- Layout switches from a centered max-width-1400px column to full-width.
- Initially reachable only via `?ui=new` in the URL for evaluation, with no
  persistence (reload without the param reverts to the old look); once
  finalized, the flag was removed and alpine became the app's only theme —
  every user now sees it by default.
- Scope was explicitly a reskin only: no restructuring toward the
  `new-ui/code.html` mockup's different layout (fixed sidebar, top nav,
  profile chip), no theme-choice persistence, no Material Symbols icons or
  full typographic scale — only base font-family and daisyui token values.

## Outcome vs. spec

Shipped matching the design spec's stated goal and non-goals: a pure
token-level reskin with no functional changes, no persistence, and no
layout restructuring beyond the centered/full-width switch. The spec
didn't anticipate the theme being made permanent and the `?ui=new` flag
removed — that followed as a separate decision once the redesign was
validated (see the linked ADR).
