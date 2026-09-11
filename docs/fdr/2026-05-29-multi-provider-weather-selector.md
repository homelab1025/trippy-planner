# FDR: Weather provider selector with a disabled self-hosted placeholder

**Date:** 2026-05-29
**Status:** Shipped
**Related:** [ADR: Provider-agnostic weather-fetching abstraction](../adr/2026-05-29-weather-provider-abstraction.md), [design spec](../superpowers/specs/done/2026-05-28-multi-provider-weather-design.md)

## Problem

The app only ever supported one weather source, with no user-visible way to
choose between sources or see that another one was planned.

## Decision (highlights)

- Tech Details panel gains a weather-provider `<select>`, populated from the
  provider registry.
- The self-hosted option is visible but greyed out, labeled "Trippy Weather
  (coming soon)" — it communicates a roadmap item without being selectable.
- Selecting a disabled option is a no-op: the `onChange` handler silently
  ignores it rather than surfacing an error.

## Outcome vs. spec

Matches the revised (2026-05-29) spec: OpenWeatherMap, proposed in the
original 2026-05-28 draft, was dropped before implementation in favor of the
self-hosted placeholder.
