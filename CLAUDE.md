# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Style

Consider all the style guides in the contributing/styleguide folder. For each programming language being used in this project there is a MD file. If there isn't, tell the user and ask him whether to add the programming language as an exception to this rule in this CLAUDE.md file.

Don't ask to do commits on your own, but let the user specify when to commit code.

## Commands

```bash
npm run dev        # start dev server at http://localhost:5173
npm run build      # type-check + Vite production build
npm run lint       # ESLint
npm run test       # run unit tests (Vitest, watch mode)
npx vitest run     # run unit tests once (CI mode)
npm run test:coverage              # unit test coverage report
npm run test:mutation              # mutation testing (Stryker); HTML report at reports/mutation/mutation.html
npx playwright test            # run all E2E tests (starts dev server automatically)
npx playwright test --ui       # interactive test runner
npx playwright test tests/app.spec.ts   # run a single test file
```

## Architecture

Single-page React app. All application state lives in `App.tsx` — no global state library. The three main concerns are:

1. **GPX parsing** (`src/utils/gpxParser.ts`) — wraps the `gpxparser` library, returns `RouteData` with cumulative distance per point in meters.

2. **Weather fetching** (`src/services/weatherService.ts`) — calls Open-Meteo's free API (no key required). Samples 11 evenly-spaced points along the route, calculates each point's arrival time from `avgSpeed` + `startTime`, then fetches hourly forecasts. Falls back to a synthetic mock when the API returns no match for the hour. Open-Meteo only provides a 7-day forecast window, so the date picker is capped at today + 7 days.

3. **Display** — `MapComponent.tsx` renders the route polyline and a hover crosshair via `react-leaflet`; `ElevationChart.tsx` renders an elevation + temperature overlay chart via `recharts`, with `WindArrowRow.tsx` and `PrecipBarRow.tsx` below it on the same distance axis.

`App.tsx` owns the `route`, `avgSpeed`, `startTime`, and `weatherPoints` state. A `useEffect` re-runs weather fetching whenever any of those change.

## Key constraints

- Functionality described in the "Features" chapter of the README.md file must always be kept. If they need to be changed due to changes that the developer asks for, then explain to him what would change and ask whether to continue
- Leaflet requires its CSS imported inside the component file and a manual icon fix (default marker images break with Vite's asset hashing — see `MapComponent.tsx:11-17`).
- `gpxparser` types the cumulative distance field as `any` — cast is necessary at `gpxParser.ts:31`.
- Playwright tests run against the live dev server on port 5173. The `webServer` config in `playwright.config.ts` starts it automatically but reuses an existing server if one is already running.

### Playwright

- whenever taking screenshots, they will be placed in playwright-screenshots/, not anywhere else.

## Pull Requests

When commit is done at the end, make sure you commit the spec if there is one.

After creating a PR for a feature, check whether a corresponding spec file exists in `docs/superpowers/specs/` (naming pattern: `YYYY-MM-DD-<feature-slug>-design.md`). If one matches, mark it as viewed on the PR using the GitHub GraphQL API:

```bash
# Step 1 — get the PR's GraphQL node ID
PR_ID=$(gh pr view <number> --json id -q .id)

# Step 2 — mark the spec file as viewed
gh api graphql -f query="
  mutation {
    markFileAsViewed(input: {pullRequestId: \"$PR_ID\", path: \"docs/superpowers/specs/<spec-file>.md\"}) {
      pullRequest { number }
    }
  }
"
```

This marks the file as viewed for the authenticated `gh` user (the PR author). No action needed if no matching spec exists.