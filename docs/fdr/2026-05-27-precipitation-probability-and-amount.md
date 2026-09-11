# FDR: Show precipitation probability and amount on the weather timeline

**Date:** 2026-05-27
**Status:** Shipped
**Related:** [ADR: Fail closed on weather-fetch failure instead of synthetic fallback](../adr/2026-05-27-weather-null-on-fetch-failure.md), [design spec](../superpowers/specs/done/2026-05-27-precipitation-timeline-design.md)

## Problem

Open-Meteo's hourly forecast already includes precipitation probability and
amount, but neither was surfaced anywhere in the UI.

## Decision (highlights)

- Precipitation probability (%) renders as a visible chart line (blue,
  `#4A90D9`), plotted against a hidden secondary Y axis (`domain={[0, 100]}`)
  so it doesn't need a third visible axis label.
- Precipitation amount (mm) is tooltip-only: a zero-stroke, dot-free line
  whose sole purpose is getting the value into Recharts' tooltip payload
  without drawing anything.
- Both fields are linearly interpolated between sampled points, the same
  treatment already given to temperature.
- Shipped in the same PR as the "weather unavailable" overlay (see companion
  ADR) — that overlay hides these same two lines whenever `weatherAvailable`
  is `false`.

## Outcome vs. spec

Matches the design spec's scope. Map marker popups and the other Open-Meteo
precipitation sub-types (`rain`, `showers`, `snowfall`) were explicitly out
of scope and remain unimplemented.
