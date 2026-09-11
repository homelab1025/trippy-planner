# FDR: Update existing route on Save instead of duplicating

**Date:** 2026-08-14
**Status:** Shipped
**Related:** [ADR: Track saved-route identity through app state](../adr/2026-08-14-saved-route-identity-tracking.md)

## Problem

Re-saving an already-saved route silently created a duplicate instead of
updating it, because Save always POSTed a new route (issues #45, #46).
Separately, there was no way to name or rename a route before saving, so
uploads without a GPX track name all defaulted to the same generic name and
were indistinguishable in My Routes.

## Decision (highlights)

- Save now updates the existing saved route in place once a route is
  tracked as saved; it only creates a new one for a genuinely new route.
- An editable route name field is added to the Save panel.
- "Save as new" (once a route is tracked as saved) explicitly forks the
  current edits into a second, independently-named saved copy.
- A duplicate action in My Routes clones an existing saved route without
  first loading it.
- Long names in My Routes are truncated with an ellipsis and shown in full
  in a hover tooltip.

## Outcome vs. spec

No design spec preceded this change — issues #45/#46 and the PR description
are the record of intended scope, and the shipped behavior matches: update
semantics on Save, editable naming, "Save as new," and duplicate-from-list
were all delivered together as one change.
