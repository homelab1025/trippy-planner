# FDR: Non-blocking GPX upload

**Date:** 2026-05-22
**Status:** Shipped
**Related:** [ADR: Move GPX parsing off the main thread](../adr/2026-05-22-gpx-parsing-web-worker.md)

## Problem

Uploading a large GPX file (50k+ points) froze the entire UI for the
duration of the parse — no spinner feedback, no interaction, all on the
main thread.

## Decision (highlights)

- No visible change to the upload flow itself: same file picker, same
  `RouteData` result.
- The only user-visible effect is that the tab stays responsive during a
  large-file parse instead of appearing to hang.

## Outcome

Shipped as described — a pure performance fix with no behavioral or UI
change. No design spec preceded this change; behavior was verified via
existing GPX parser tests plus new coverage for the worker client
(`gpxWorkerClient.test.ts`).
