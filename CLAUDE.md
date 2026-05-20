# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server at http://localhost:5173
npm run build      # type-check + Vite production build
npm run lint       # ESLint
npx playwright test            # run all E2E tests (starts dev server automatically)
npx playwright test --ui       # interactive test runner
npx playwright test tests/app.spec.ts   # run a single test file
```

## Architecture

Single-page React app. All application state lives in `App.tsx` — no global state library. The three main concerns are:

1. **GPX parsing** (`src/utils/gpxParser.ts`) — wraps the `gpxparser` library, returns `RouteData` with cumulative distance per point in meters.

2. **Weather fetching** (`src/services/weatherService.ts`) — calls Open-Meteo's free API (no key required). Samples 11 evenly-spaced points along the route, calculates each point's arrival time from `avgSpeed` + `startTime`, then fetches hourly forecasts. Falls back to a synthetic mock when the API returns no match for the hour. Open-Meteo only provides a 7-day forecast window, so the date picker is capped at today + 7 days.

3. **Display** — `MapComponent.tsx` renders the route polyline and weather markers via `react-leaflet`; `WeatherTimeline.tsx` renders an elevation + temperature overlay chart via `recharts`.

`App.tsx` owns the `route`, `avgSpeed`, `startTime`, and `weatherPoints` state. A `useEffect` re-runs weather fetching whenever any of those change.

## Key constraints

- Leaflet requires its CSS imported inside the component file and a manual icon fix (default marker images break with Vite's asset hashing — see `MapComponent.tsx:11-17`).
- `gpxparser` types the cumulative distance field as `any` — cast is necessary at `gpxParser.ts:31`.
- Playwright tests run against the live dev server on port 5173. The `webServer` config in `playwright.config.ts` starts it automatically but reuses an existing server if one is already running.
