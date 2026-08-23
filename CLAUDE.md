# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Style

Consider all the style guides in the contributing/styleguide folder. For each programming language being used in this project there is a MD file. If there isn't, tell the user and ask him whether to add the programming language as an exception to this rule in this CLAUDE.md file.

Don't ask to do commits on your own, but let the user specify when to commit code.

## Commands

### Frontend (run from `frontend/`)
```bash
cd frontend && npm run dev        # start dev server at http://localhost:5173
cd frontend && npm run build      # type-check + Vite production build
cd frontend && npm run lint       # ESLint
cd frontend && npx vitest run     # run unit tests once (CI mode)
cd frontend && npx playwright test  # run all E2E tests
cd frontend && npm run generate:api # regenerate TypeScript Axios client from openapi.yaml
```

### Backend (run from `backend/`)
```bash
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local   # start backend at http://localhost:8080
cd backend && ./mvnw test              # run unit + integration tests
cd backend && ./mvnw test jacoco:report # run tests + generate JaCoCo HTML coverage report (backend/target/site/jacoco/index.html)
cd backend && ./mvnw generate-sources  # regenerate Spring interfaces from openapi.yaml
```

### Full stack
```bash
make dev        # start everything via docker-compose
make generate   # regenerate both TypeScript client and Spring interfaces
make build      # build both Docker images
make test       # run all tests
```

## Architecture

The repo is a monorepo with two sub-projects:

- **Frontend** (`frontend/`) — Vite/React/TypeScript SPA. All application state lives in `frontend/src/App.tsx` — no global state library. The main concerns are:

  1. **GPX parsing** (`frontend/src/utils/gpxParser.ts`) — parses the raw XML with `fast-xml-parser` (not the `gpxparser` npm package, which was removed because it depends on `window.DOMParser` and can't run in a Web Worker), returning `RouteData` with cumulative distance per point in meters. Parsing runs off the main thread via `frontend/src/workers/gpxWorker.ts` (invoked through `gpxWorkerClient.ts`), then the route is decimated with Douglas-Peucker (`utils/douglasPeucker.ts`).

  2. **Weather fetching** (`frontend/src/services/weatherProviders/`) — a small provider abstraction (`types.ts`, `index.ts`) with an Open-Meteo implementation (`openMeteo.ts`, no key required) and a not-yet-available self-hosted provider stub (`selfHosted.ts`) selectable from the Tech Details panel. Samples points roughly every 5 km along the route (minimum 11 points on short routes), calculates each point's arrival time from `avgSpeed` + `startTime`, then fetches hourly forecasts. A failed or out-of-range lookup now returns `null` per point (no synthetic mock fallback) and the UI shows an "unavailable" message instead. Open-Meteo only provides a 7-day forecast window, so the date picker is capped at today + 7 days.

  3. **Display** — `frontend/src/components/MapComponent.tsx` renders the route polyline and a hover crosshair via `react-leaflet`; `frontend/src/components/ElevationChart.tsx` renders an elevation + temperature overlay chart via `recharts` (with detected climbs from `utils/climbDetector.ts` overlaid), with `WindArrowRow.tsx` and `PrecipBarRow.tsx` below it on the same distance axis.

  4. **Accounts, saved routes, and sharing** — `auth.ts` stores the session token in `localStorage`; `apiClient.ts` wraps the generated auth/routes/share API clients. `SignInPanel.tsx` drives the magic-link sign-in flow, `SaveRouteButton.tsx` and `MyRoutesPanel.tsx` handle saving/reloading routes, and `ShareToggle.tsx` manages public share links. `routeStorage.ts` mirrors the current working route to `localStorage` so it survives a full page reload.

  `frontend/src/App.tsx` owns the `route`, `avgSpeed`, `startTime`, and `weatherPoints` state. A `useEffect` re-runs weather fetching whenever any of those change.

- **Backend** (`backend/`) — Java Spring Boot service (JVM, fat JAR). Generates controller interfaces and model DTOs from `openapi.yaml` at build time. Implements REST endpoints for auth (`AuthController`), route persistence (`RoutesController`), and public sharing (`ShareController`).

- **API contract** (`openapi.yaml`) — single source of truth. Both frontend and backend generate code from it at build time via `make generate`.

- **Orchestration** (root) — `docker-compose.yml` for local dev (frontend + backend + postgres), `Makefile` for common tasks, `k8s/` for Kubernetes deployment.

## Key constraints

- Functionality described in the "Features" chapter of the README.md file must always be kept. If they need to be changed due to changes that the developer asks for, then explain to him what would change and ask whether to continue
- Leaflet requires its CSS imported inside the component file (`frontend/src/components/MapComponent.tsx`). Route/hover markers use `react-leaflet`'s `CircleMarker` (vector-drawn), not the default `Marker` icon, so there's no default-marker-image/Vite-asset-hashing fix needed here.
- Playwright tests run against the live dev server on port 5173. The `webServer` config in `frontend/playwright.config.ts` starts it automatically but reuses an existing server if one is already running.
- Generated code (`frontend/src/api/`, `backend/target/`) is gitignored and must be regenerated from `openapi.yaml` before building.

### Playwright

- whenever taking screenshots, they will be placed in frontend/playwright-screenshots/, not anywhere else.

### Tooltips

- Any tooltip added to the frontend UI must use `frontend/src/components/Tooltip.tsx`, not the native HTML `title` attribute — `title`'s show delay and dismiss behavior aren't controllable and are inconsistent across browsers (this is why the DP Epsilon/Max Gap tooltips in Tech Details were migrated off of it).
- Behavior contract for every tooltip: it opens after a short hover delay (`TOOLTIP_SHOW_DELAY_MS`, currently 500ms) over the trigger, or immediately on click/Enter/Space; it closes only once the pointer leaves both the trigger and the tooltip content itself (not immediately on leaving the trigger alone, so the pointer can move onto the tooltip to read it).

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