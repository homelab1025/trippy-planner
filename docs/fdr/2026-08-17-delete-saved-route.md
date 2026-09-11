# FDR: Delete action for saved routes

**Date:** 2026-08-17
**Status:** Shipped
**Related:** [design spec](../superpowers/specs/2026-08-16-delete-saved-route-design.md)

## Problem

Saved routes could be created, renamed, and duplicated but never removed —
there was no way to clean up My Routes once a route was no longer wanted.
The backend `DELETE /routes/{id}` endpoint already existed; only the
frontend flow was missing.

## Decision (highlights)

- A delete icon next to the duplicate icon in My Routes opens a new generic
  `ConfirmDialog` component (same visual style as the sign-in dialog),
  rather than a delete-specific modal, so future destructive actions can
  reuse it.
- The confirmation message names the route and its ride date, e.g.
  `Delete 'Alpine Loop' on the 17 Jun 2026?`.
- Deleting the currently-loaded route resets the main view (map + elevation
  chart) to empty and clears the `localStorage` mirror; deleting any other
  route only updates the list.

## Outcome vs. spec

Shipped as specified in the linked design spec — no deviations. Built via
subagent-driven development (5 tasks, each independently reviewed) plus a
final whole-branch review, with no Critical/Important findings.
