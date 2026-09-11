# Feature Decision Records

Records of product/feature-level decisions — what a feature does, the key
behavioral choices, and how the shipped result compares to whatever spec
preceded it. For the technical/architectural decision behind a feature, see
[`docs/adr/`](../adr/).

Files are named `YYYY-MM-DD-<slug>.md`. The date is the decision date, not the
file's creation date, so records can be added out of order — including
earlier decisions backfilled after the fact — without renumbering anything.
The table below is kept sorted chronologically.

| Date | Title | Status |
|---|---|---|
| 2026-05-22 | [Non-blocking GPX upload](2026-05-22-gpx-parsing-web-worker.md) | Shipped |
| 2026-05-23 | [Tech Details panel for point-reduction tuning](2026-05-23-douglas-peucker-tech-details.md) | Shipped |
| 2026-05-27 | [Build info panel](2026-05-27-build-info-panel.md) | Shipped |
| 2026-05-27 | [Show precipitation probability and amount on the weather timeline](2026-05-27-precipitation-probability-and-amount.md) | Shipped |
| 2026-05-29 | [Weather provider selector with a disabled self-hosted placeholder](2026-05-29-multi-provider-weather-selector.md) | Shipped |
| 2026-06-01 | [Visual climb markers with hover detail popup](2026-06-01-climb-visual-markers-with-hover-popup.md) | Shipped |
| 2026-06-05 | [Sidebar weather accordion and persistent hover pane](2026-06-05-sidebar-weather-accordion-and-hover-pane.md) | Shipped |
| 2026-06-06 | [Move the precipitation chart under the elevation chart](2026-06-06-precip-chart-under-elevation.md) | Shipped |
| 2026-06-06 | [Move the temp+wind chart into the main elevation card, remove the sidebar Weather panel](2026-06-06-tempwind-chart-into-main-card.md) | Shipped |
| 2026-07-18 | [Accounts, saved routes, and public sharing](2026-07-18-accounts-saved-routes-and-sharing.md) | Shipped |
| 2026-08-03 | [Persist working route across sign-in, decouple sign-in from saving](2026-08-03-persist-route-across-signin.md) | Shipped |
| 2026-08-14 | [Update existing route on Save instead of duplicating](2026-08-14-save-route-update-rename-duplicate.md) | Shipped |
| 2026-08-15 | [Show backend version in Tech Details](2026-08-15-show-backend-version.md) | Shipped |
| 2026-08-17 | [Delete action for saved routes](2026-08-17-delete-saved-route.md) | Shipped |
| 2026-08-23 | [Edit DP Epsilon/Max Gap after a route is loaded](2026-08-23-editable-tech-details-params.md) | Shipped |
| 2026-09-01 | [Alpine Explorer visual redesign](2026-09-01-alpine-visual-redesign.md) | Shipped |
| 2026-09-10 | [Pin arrival times at checkpoints along the route](2026-09-10-checkpoint-arrival-times.md) | Shipped |
