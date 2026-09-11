# Architecture Decision Records

Records of decisions about the technical structure of the system — data models,
module boundaries, persistence strategy, cross-cutting technical trade-offs.
For product/feature-level decisions (what we build and why, from a user
perspective), see [`docs/fdr/`](../fdr/).

Files are named `YYYY-MM-DD-<slug>.md`. The date is the decision date, not the
file's creation date, so records can be added out of order — including
earlier decisions backfilled after the fact — without renumbering anything.
The table below is kept sorted chronologically.

| Date | Title | Status |
|---|---|---|
| 2026-05-22 | [Move GPX parsing off the main thread](2026-05-22-gpx-parsing-web-worker.md) | Accepted |
| 2026-05-23 | [Douglas-Peucker route decimation with configurable epsilon and max-gap fill](2026-05-23-douglas-peucker-decimation.md) | Accepted |
| 2026-05-26 | [Semver-based two-workflow release process](2026-05-26-semver-release-workflow.md) | Accepted |
| 2026-05-27 | [Fail closed on weather-fetch failure instead of synthetic fallback](2026-05-27-weather-null-on-fetch-failure.md) | Accepted |
| 2026-05-29 | [Provider-agnostic weather-fetching abstraction](2026-05-29-weather-provider-abstraction.md) | Accepted |
| 2026-06-01 | [Climb detection via Strava scoring, rendered as a Recharts-injected SVG overlay](2026-06-01-climb-detection-and-overlay-rendering.md) | Accepted |
| 2026-06-05 | [Split the single weather chart into focused components sharing one data hook](2026-06-05-chart-split-architecture.md) | Accepted |
| 2026-06-06 | [Migrate hand-rolled UI to DaisyUI v4 + Tailwind CSS](2026-06-06-daisyui-tailwind-migration.md) | Accepted |
| 2026-06-06 | [Use distance, not time, as the chart X-axis reference](2026-06-06-distance-based-chart-xaxis.md) | Accepted |
| 2026-06-08 | [Render wind/precip rows as hand-built SVG instead of Recharts](2026-06-08-svg-wind-precip-rows.md) | Accepted |
| 2026-06-12 | [u/v vector decomposition for wind interpolation, time-based interpolation factor](2026-06-12-wind-uv-vector-interpolation.md) | Accepted |
| 2026-07-18 | [Backend service, magic-link auth, and route persistence architecture](2026-07-18-backend-auth-and-persistence-architecture.md) | Accepted |
| 2026-08-03 | [Mirror the working route to localStorage; decouple sign-in from Save](2026-08-03-local-route-mirror-decoupled-auth.md) | Accepted |
| 2026-08-07 | [Independent frontend/backend versioning and release workflows](2026-08-07-independent-component-versioning.md) | Accepted |
| 2026-08-14 | [Track saved-route identity through app state to disambiguate create vs. update](2026-08-14-saved-route-identity-tracking.md) | Accepted |
| 2026-08-15 | [Pin prod deployments to explicit release versions instead of :latest](2026-08-15-pin-prod-releases-not-latest.md) | Accepted |
| 2026-08-23 | [Custom Tooltip component; Tech Details params re-parse via a single commit function](2026-08-23-custom-tooltip-and-live-tech-params.md) | Accepted |
| 2026-09-01 | [Ship the alpine reskin behind a URL flag, then collapse to a single theme](2026-09-01-alpine-theme-collapse.md) | Accepted |
| 2026-09-10 | [Checkpoint-based arrival-time model](2026-09-10-checkpoint-arrival-time-model.md) | Accepted |
