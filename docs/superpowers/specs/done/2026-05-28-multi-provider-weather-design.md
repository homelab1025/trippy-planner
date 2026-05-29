# Multi-Provider Weather Support

**Date:** 2026-05-28  
**Last revised:** 2026-05-29  
**Status:** Revised — see changelog at bottom

## Overview

Abstract the weather fetching layer so it is provider-agnostic. The registry contains two providers:

1. **Open-Meteo** — the existing free provider, fully functional, the default selection.
2. **Self-hosted (Trippy Weather)** — a placeholder for a future backend this app will host. It is visible in the provider dropdown but cannot be selected; it is wired up now so the integration point is defined and the UI contract is established.

The user selects the active provider from the Tech Details panel. Unavailable providers are shown greyed out and disabled.

## Architecture

```
src/
  services/
    weatherProviders/
      types.ts        ← WeatherProvider interface + WeatherRequest + WeatherData
      openMeteo.ts    ← Open-Meteo provider factory
      selfHosted.ts   ← Placeholder provider (available: false)
      index.ts        ← PROVIDERS registry + DEFAULT_PROVIDER
```

No `src/config/weatherProviderKeys.ts` — neither provider requires an API key.

## WeatherProvider Interface

```ts
// types.ts
export interface WeatherRequest {
  lat: number;
  lon: number;
  timestamp: number; // Unix seconds
}

export interface WeatherProvider {
  id: string;
  label: string;
  available: boolean; // false = shown in selector but cannot be chosen
  fetchWeather: (points: Map<number, WeatherRequest>) => Promise<Map<number, WeatherData | null>>;
}
```

The `available` field is the single gate for whether a provider can be selected. The UI uses it to disable the corresponding `<option>` and to guard the `onChange` handler. `WeatherData` and `HttpClient` are unchanged and defined in `types.ts`.

The integer key in `fetchWeather` is the index of each sampled point in `RouteData.points`. The output map uses the same keys so `App.tsx` can join results back to route metadata without a parallel array.

## Provider Registry

```ts
// index.ts
export const PROVIDERS: WeatherProvider[] = [
  openMeteoProvider,   // available: true
  selfHostedProvider,  // available: false
];

export const DEFAULT_PROVIDER = openMeteoProvider;
```

When the self-hosted backend is eventually built, setting `available: true` and replacing the mock `fetchWeather` body is the only change needed in `selfHosted.ts`.

## Self-Hosted Provider

`selfHosted.ts` exports a single `WeatherProvider` object:

```ts
export const selfHostedProvider: WeatherProvider = {
  id: 'self-hosted',
  label: 'Trippy Weather (coming soon)',
  available: false,
  fetchWeather: async (_points) => new Map(), // not yet implemented
};
```

It returns an empty map from `fetchWeather` — not because it will ever be called from the UI (it won't, since `available: false` prevents selection), but to satisfy the interface contract and remain testable as a unit.

## App.tsx Changes

- New state: `const [selectedProvider, setSelectedProvider] = useState<WeatherProvider>(DEFAULT_PROVIDER)`
- `updateWeather` builds a `Map<number, WeatherRequest>` keyed by each sampled point's index in `route.points`, then calls `selectedProvider.fetchWeather(points)` once
- Result is joined back to route metadata (`RoutePoint`, `arrivalTime`, `label`) using the same index keys
- `useEffect` dependency array includes `selectedProvider`
- Tech Details panel has a `<select>` populated from `PROVIDERS`:
  - Each `<option>` is `disabled` when `!provider.available`
  - The `onChange` handler guards against selecting unavailable providers: only calls `setSelectedProvider` if the found provider has `available: true`

```tsx
<select
  id="weather-provider"
  value={selectedProvider.id}
  onChange={(e) => {
    const next = PROVIDERS.find(p => p.id === e.target.value && p.available);
    if (next) setSelectedProvider(next);
  }}
>
  {PROVIDERS.map(p => (
    <option key={p.id} value={p.id} disabled={!p.available}>
      {p.label}
    </option>
  ))}
</select>
```

## weatherService.ts

Removed. `App.tsx` calls `provider.fetchWeather(points)` directly. Existing tests migrated to `openMeteo.test.ts`.

## Error Handling

Each provider catches errors per-point internally and maps `null` at that key on failure. `App.tsx`'s `weatherAvailable` state already handles the all-nulls case. No new error states.

## Testing

- Open-Meteo provider: tests cover successful fetch, null on HTTP error, null on missing time slot, key preservation, condition mapping
- Self-hosted provider: single test verifying it returns an empty map (the entire contract of the placeholder)
- `App.tsx`: the `available: false` guard is tested — attempting to select a disabled provider via `onChange` does not change `selectedProvider`

## Changelog

| Date | Change |
|------|--------|
| 2026-05-28 | Initial spec: Open-Meteo + OpenWeatherMap |
| 2026-05-29 | Revised: replace OpenWeatherMap with self-hosted placeholder; add `available` field to `WeatherProvider` |
