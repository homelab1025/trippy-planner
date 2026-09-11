# ADR: Track saved-route identity through app state to disambiguate create vs. update

**Date:** 2026-08-14
**Status:** Accepted
**Related:** [FDR: Update existing route on Save instead of duplicating](../fdr/2026-08-14-save-route-update-rename-duplicate.md)

## Context

`SaveRouteButton` always called `createRoute` (POST), even when the
currently-loaded route had already been saved — there was no record
anywhere of "this working route corresponds to saved route X" once a route
had been saved and reloaded. Re-saving therefore silently created a
duplicate row instead of updating the existing one (issues #45, #46).

## Decision

- Track the saved route's id as part of the working-route state, threaded
  through the same three places `route`/`avgSpeed`/`startTime` already flow
  through: in-memory app state, the `localStorage` mirror (`routeStorage.ts`),
  and selection from `MyRoutesPanel`.
- `SaveRouteButton` calls `updateRoute` (PUT) when a saved-route id is
  already tracked, and falls back to `createRoute` (POST) only when it's
  genuinely untracked (a fresh GPX upload, or after "Save as new").
- "Save as new" explicitly clears the tracked id before saving, so forking a
  copy is a deliberate action rather than something inferred from edits.

## Alternatives considered

- **Ask the backend to detect duplicates** (e.g. by GPX content hash) —
  rejected; it would guess at user intent and couldn't distinguish "re-save
  my edits" from "I want a second copy," which the explicit "Save as new"
  action handles directly instead.

## Consequences

- Any future flow that loads a route into the working state (open from My
  Routes, share-link import, etc.) must decide whether to set or clear the
  tracked saved-route id, or it will silently misroute Save to update the
  wrong route or the wrong target.
- The tracked id lives in the same `localStorage` mirror as the rest of the
  working route, so it survives a full page reload the same way.
