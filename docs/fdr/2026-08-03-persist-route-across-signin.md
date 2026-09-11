# FDR: Persist working route across sign-in, decouple sign-in from saving

**Date:** 2026-08-03
**Status:** Shipped
**Related:** [ADR: Mirror the working route to localStorage; decouple sign-in from Save](../adr/2026-08-03-local-route-mirror-decoupled-auth.md), [design spec](../superpowers/specs/2026-08-01-local-route-persistence-design.md)

## Problem

A route uploaded before signing in was lost the moment the user clicked
their magic link, because the link click forces a full page reload and the
route existed only in memory — so by the time the account existed, there
was nothing left to save (issue #44).

## Decision (highlights)

- The working route (GPX, speed, start time) now survives a page reload via
  a `localStorage` mirror, so clicking the magic link no longer loses it.
- Signing in is available any time from the header, not only when the user
  is in the middle of trying to save — the "Save route" prompt now just
  triggers the same sign-in flow rather than owning its own.
- After confirming their email and returning via the magic link, the user
  sees their route exactly as they left it and can click "Save route"
  themselves — saving does not happen automatically on that return.

## Outcome vs. spec

Shipped as specified, including the explicit decision not to auto-save on
return from the magic-link reload. Two related issues were scoped out and
deferred at spec time: #46 (Save duplicating an already-saved route instead
of updating it — addressed in a later change) and #47 (a superseded
magic-link token remains valid until natural expiry) — #47 is still open.
