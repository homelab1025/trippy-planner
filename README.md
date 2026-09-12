# Trippy Planner

A route weather planner for cyclists and hikers. Upload a GPX file, set your start time and average speed, and see what the weather will be like at each point along your route.

**Live app:** https://trippy.homelab1025.com/

## Features

- **GPX route loading** — upload any GPX track file to visualise your route
- **Interactive map** — the full route is drawn on a map; hovering over the timeline moves a crosshair on the map to the corresponding position along the route
- **Route stats** — distance and elevation gain are shown after loading a file; a Tech Details panel shows original/decimated point counts and parse timing, lets you tune the Douglas-Peucker simplification and switch weather provider, and displays the running frontend/backend version and build time
- **Configurable ride parameters** — set your average speed (km/h) and planned start date/time to calculate when you'll reach each point
- **Real weather data** — uses the Open-Meteo free API (no API key required); samples the route roughly every 5 km (at least 11 points, so short routes are still covered) and fetches hourly forecasts for each point, based on your calculated arrival time
- **7-day forecast window** — the date picker is capped at today + 7 days, matching Open-Meteo's forecast horizon
- **Accounts and route sharing** — sign in with a passwordless magic-link email to save routes to your account; saved routes can be reloaded or deleted (with a confirmation prompt) from the "My routes" panel, and any saved route can be made publicly viewable via a shareable `/share/:token` link that works without the viewer signing in

### Timeline

- a combined chart shows the elevation profile overlaid with interpolated temperature across the route
- detected climbs are overlaid on the elevation profile as colour-coded category badges (Cat 4 to HC), showing length and average grade on hover
- the X axis shows distance (km)
- a wind arrow row and a precipitation bar row are rendered below the chart, aligned to the same distance axis
- when hovering over the chart, a side pane shows the time (clock or elapsed), distance, elevation, temperature, wind speed, and precipitation probability + amount at that point

## Versioning

Frontend and backend are versioned and released independently — each has its own semantic version (`frontend/package.json`, `backend/pom.xml`) and follows the standard SNAPSHOT convention: the version on `master` always carries a `-SNAPSHOT` suffix between releases. There's no shared "app version"; releasing a backend fix doesn't bump or re-release the frontend, and vice versa.

A release is triggered manually via the `Release Frontend` or `Release Backend` GitHub Actions workflow (`workflow_dispatch`, with a `bump_type` input of `major`/`minor`/`patch`). Each strips the `-SNAPSHOT` suffix, runs that component's tests, builds and pushes its Docker image tagged with both the release version and `latest`, tags the commit (`frontend-vX.Y.Z` / `backend-vX.Y.Z`), then bumps to the next `-SNAPSHOT` version for continued development.

## Test Coverage

Combined frontend (Vitest/v8) and backend (JaCoCo) coverage reports are published to GitHub Pages on every push to `master`: https://homelab1025.github.io/trippy-planner/