# FDR: Show backend version in Tech Details

**Date:** 2026-08-15
**Status:** Shipped
**Related:** [ADR: Pin prod deployments to explicit release versions](../adr/2026-08-15-pin-prod-releases-not-latest.md), [design spec](../superpowers/specs/2026-08-15-version-display-design.md)

## Problem

Tech Details already showed the frontend's version but not the backend's,
so there was no way to tell from the UI which backend build was actually
running — a gap made more visible by the `:latest`-drift bug fixed
alongside this change.

## Decision (highlights)

- New public `GET /version` backend endpoint, backed by Spring Boot's
  `BuildProperties`.
- Frontend fetches and displays it under the existing frontend version line
  in Tech Details, with no fallback shown on fetch failure — matching the
  existing convention for weather-fetch failures rather than inventing a
  new error-display pattern.

## Outcome vs. spec

Shipped as specified in the linked design spec; the CI/deploy-pin half of
this change (routing prod to explicit release tags) is the companion ADR
and could only be proven by an actual release run, not from the sandbox
this was built in.
