# FDR: Build info panel

**Date:** 2026-05-27
**Status:** Shipped
**Related:** none

## Problem

There was no way to tell which version was actually deployed/running
without checking CI or the container registry directly.

## Decision (highlights)

- Add a small, always-visible **Build Info panel** pinned to the bottom of
  the sidebar, below a newly-introduced scrollable wrapper around the rest
  of the sidebar content, showing the app version and build date.
- Version and build date are injected at Vite build time
  (`__APP_VERSION__`, `__BUILD_DATE__`) from `package.json` and the build
  timestamp; no runtime fetch.
- Initially also showed the git SHA (`__GIT_SHA__`, flowed from GitHub
  Actions through a Docker build-arg into a `VITE_GIT_SHA` env var,
  falling back to `'local'` in dev) — removed again the same day in a
  follow-up commit, without a stated reason in the commit history.
- Reuses the existing glass-panel design system; no new card styling
  introduced.

## Outcome

Shipped, then partially reverted within hours: the git SHA display (and
its whole build-arg → env-var → define pipeline) was removed the same
day, leaving only version + build date. No design spec preceded this
change.
