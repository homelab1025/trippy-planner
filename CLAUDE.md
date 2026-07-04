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
cd backend && ./mvnw spring-boot:run   # start backend at http://localhost:8080
cd backend && ./mvnw test              # run unit + integration tests
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

- **Frontend** (`frontend/`) — Vite/React/TypeScript SPA. All application state lives in `frontend/src/App.tsx` — no global state library. The three main concerns are:

  1. **GPX parsing** (`frontend/src/utils/gpxParser.ts`) — wraps the `gpxparser` library, returns `RouteData` with cumulative distance per point in meters.

  2. **Weather fetching** (`frontend/src/services/weatherService.ts`) — calls Open-Meteo's free API (no key required). Samples 11 evenly-spaced points along the route, calculates each point's arrival time from `avgSpeed` + `startTime`, then fetches hourly forecasts. Falls back to a synthetic mock when the API returns no match for the hour. Open-Meteo only provides a 7-day forecast window, so the date picker is capped at today + 7 days.

  3. **Display** — `frontend/src/components/MapComponent.tsx` renders the route polyline and a hover crosshair via `react-leaflet`; `frontend/src/components/ElevationChart.tsx` renders an elevation + temperature overlay chart via `recharts`, with `WindArrowRow.tsx` and `PrecipBarRow.tsx` below it on the same distance axis.

  `frontend/src/App.tsx` owns the `route`, `avgSpeed`, `startTime`, and `weatherPoints` state. A `useEffect` re-runs weather fetching whenever any of those change.

- **Backend** (`backend/`) — Java Spring Boot service (JVM, fat JAR). Generates controller interfaces and model DTOs from `openapi.yaml` at build time. Implements REST endpoints for auth, route persistence, and public sharing.

- **API contract** (`openapi.yaml`) — single source of truth. Both frontend and backend generate code from it at build time via `make generate`.

- **Orchestration** (root) — `docker-compose.yml` for local dev (frontend + backend + postgres), `Makefile` for common tasks, `k8s/` for Kubernetes deployment.

## Key constraints

- Functionality described in the "Features" chapter of the README.md file must always be kept. If they need to be changed due to changes that the developer asks for, then explain to him what would change and ask whether to continue
- Leaflet requires its CSS imported inside the component file and a manual icon fix (default marker images break with Vite's asset hashing — see `frontend/src/components/MapComponent.tsx:11-17`).
- `gpxparser` types the cumulative distance field as `any` — cast is necessary at `frontend/src/utils/gpxParser.ts:31`.
- Playwright tests run against the live dev server on port 5173. The `webServer` config in `frontend/playwright.config.ts` starts it automatically but reuses an existing server if one is already running.
- Generated code (`frontend/src/api/`, `backend/target/`) is gitignored and must be regenerated from `openapi.yaml` before building.

### Playwright

- whenever taking screenshots, they will be placed in frontend/playwright-screenshots/, not anywhere else.

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