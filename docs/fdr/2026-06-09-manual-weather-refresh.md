# FDR: Auto-fetch weather on GPX load, manual Refresh for later parameter changes

**Date:** 2026-06-09
**Status:** Shipped
**Related:** none — no design spec preceded this change

## Problem

Weather re-fetched automatically on every change to `avgSpeed`, `startTime`,
or the selected provider, including live keystrokes in a numeric field —
firing repeated Open-Meteo calls for values the user hadn't finished
setting.

## Decision (highlights)

- Weather still auto-fetches once, immediately after a GPX file is parsed,
  using whatever `avgSpeed`/`startTime`/provider are set at that moment.
- After that first fetch, changing `avgSpeed`, `startTime`, or provider only
  marks the current weather stale (`isDirty`); it no longer triggers a
  refetch. A "Refresh" button (initially labeled "Refresh Weather", shortened
  to fit the row) appears next to the Clock/Elapsed toggle whenever
  `isDirty` is true, and fetching only happens when the user clicks it.
- `route` is dropped from the dirty-check (`lastFetchedParams`) once
  fetch-on-load guarantees weather is always fetched against the route
  currently loaded — the field became redundant, not replaced by another
  check.

## Outcome

No design spec preceded this change. Reconstructed from commit history: an
initial commit removed auto-fetch entirely in favor of a manual button, and
two same-day follow-ups revised that to fetch-on-load with manual refresh
reserved for later parameter changes — the hybrid behavior that actually
shipped is narrower than the PR title ("replace auto-fetch with manual
Refresh Weather button") suggests on its own. Two E2E test commits bundled
into the same PR cover the Clock/Elapsed toggle's effect on hover-pane time
formatting — unrelated regression coverage, not a decision of this record.
