# ADR: Fail closed on weather-fetch failure instead of synthetic fallback

**Date:** 2026-05-27
**Status:** Accepted
**Related:** [FDR: Show precipitation probability and amount on the weather timeline](../fdr/2026-05-27-precipitation-probability-and-amount.md), [design spec](../superpowers/specs/done/2026-05-27-weather-unavailable-overlay-design.md)

## Context

`weatherService.ts` silently returned synthetic data via a `mockFallback` object
whenever the Open-Meteo API failed or the requested date fell outside the
7-day forecast window. The user saw plausible-looking temperature and
precipitation values with no indication they were fake.

## Decision

- Delete `mockFallback` entirely. `fetchWeatherForPoint`'s return type changes
  to `Promise<WeatherData | null>`; both failure paths (`timeIndex === -1`
  when the exact forecast hour isn't in the response, and the network/API
  error `catch` block) return `null` instead of a constructed value.
- `App.tsx` tracks a tri-state `weatherAvailable: boolean | null` — `null`
  while a fetch is in progress, `true` once at least one point resolved,
  `false` once every point resolved to `null` — reset at the start of each
  fetch effect.
- `WeatherTimeline` shows a centered "Weather data unavailable for the
  selected date" message and hides the temperature/precipitation lines when
  `weatherAvailable === false`. The elevation profile keeps rendering
  normally regardless.

## Consequences

- Partial failures stay transparent: if a subset of points resolves,
  `weatherAvailable` is `true` and the chart renders whatever partial data
  came back — this was already the behavior for individual missing points
  and is preserved rather than redesigned.
- This established the "return `null` per point, no synthetic fallback"
  contract that every later weather integration has to honor, including the
  provider abstraction added right after (see [ADR: Provider-agnostic
  weather-fetching abstraction](2026-05-29-weather-provider-abstraction.md))
  and the checkpoint-based arrival-time model much later, which explicitly
  relies on this same per-point `null`/"unavailable" fallback rather than
  adding new handling of its own (see [ADR: Checkpoint-based arrival-time
  model](2026-09-10-checkpoint-arrival-time-model.md)).
