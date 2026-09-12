# ADR: Provider-agnostic weather-fetching abstraction

**Date:** 2026-05-29
**Status:** Accepted
**Related:** [FDR: Weather provider selector with a disabled self-hosted placeholder](../fdr/2026-05-29-multi-provider-weather-selector.md), [design spec](../superpowers/specs/done/2026-05-28-multi-provider-weather-design.md)

## Context

`weatherService.ts` was a single hardcoded Open-Meteo integration. A future
self-hosted weather backend was anticipated, and the app needed a defined
integration point for it before that backend existed.

## Decision

- New `src/services/weatherProviders/` module: a `WeatherProvider` interface
  (`id`, `label`, `available`, `fetchWeather(points) => Promise<Map<index,
  WeatherData | null>>`), batch-oriented and keyed by each point's index in
  `RouteData.points` so results join back to route metadata without a
  parallel array.
- A provider registry (`PROVIDERS` + `DEFAULT_PROVIDER`) lists Open-Meteo
  (`available: true`) and a self-hosted placeholder (`available: false`,
  `fetchWeather` returns an empty map) — wired into the registry and UI now
  so the contract is fixed even though the backend doesn't exist yet.
- `available` is the single gate: the Tech Details `<select>` disables the
  corresponding `<option>`, and the `onChange` handler only calls
  `setSelectedProvider` when the matched provider has `available: true`.
- `weatherService.ts` is deleted; `App.tsx` calls
  `selectedProvider.fetchWeather(points)` directly.

## Consequences

- Every provider must independently satisfy the null-per-point failure
  contract established in [ADR: Fail closed on weather-fetch failure instead
  of synthetic fallback](2026-05-27-weather-null-on-fetch-failure.md) — the
  self-hosted placeholder's empty-map return is a degenerate case of the same
  contract.
- Turning on the real self-hosted backend later only requires setting
  `available: true` and implementing `fetchWeather` in `selfHosted.ts`; no
  registry, UI, or `App.tsx` changes are needed.
