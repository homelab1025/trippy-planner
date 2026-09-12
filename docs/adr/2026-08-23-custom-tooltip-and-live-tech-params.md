# ADR: Custom Tooltip component; Tech Details params re-parse via a single commit function

**Date:** 2026-08-23
**Status:** Accepted
**Related:** [FDR: Edit DP Epsilon/Max Gap after a route is loaded](../fdr/2026-08-23-editable-tech-details-params.md)

## Context

DP Epsilon and Max Gap in the Tech Details panel were frozen once a route
existed — they could only be set before upload. Making them live-editable
raised two separate technical problems:

- The two inputs' help text used the native `title` attribute, whose show
  delay and dismiss behavior can't be controlled and differ across browsers
  (notably Safari) — becoming more visible once these fields were the
  primary way to steer a live re-parse.
- Editing a param needs to re-parse the already-uploaded raw GPX and
  re-fetch weather, but only when the committed value actually changed —
  naive re-parsing on every blur/Enter/Reset click would triple-fire for
  a single logical edit (change → blur → equal-value re-render).

## Decision

- Build a small reusable `Tooltip` component (`frontend/src/components/Tooltip.tsx`):
  opens after `TOOLTIP_SHOW_DELAY_MS` (500ms) of hover, or immediately on
  click/Enter/Space; closes only once the pointer leaves both the trigger
  and the tooltip content (a short hide-grace-window avoids flicker when
  crossing the DOM gap between them). The trigger is a `<span role="button">`,
  not a real `<button>`, because it's typically nested inside a `<label>`
  next to the input it documents, and a real button there would register as
  a second labelable control under `getByLabelText`/assistive tech.
- Document this as the mandatory pattern for any future tooltip in
  `CLAUDE.md`, superseding `title` project-wide, not just for these two
  fields.
- Track the epsilon/maxGap values actually baked into the current `route`
  in `appliedTechParamsRef`, and fold the re-parse into a single
  `applyTechParams(epsilon, maxGap)` function (later generalized from an
  initial `commitTechParams` once the Reset button needed the same path).
  It no-ops if the values match what's already applied or a commit is
  already in flight (`techCommitInFlightRef`), and is the only path blur,
  Enter, and Reset-to-defaults funnel through.

## Consequences

- Every tooltip added anywhere in the app from now on must use this
  component (see `CLAUDE.md`'s Tooltips section) — a cross-cutting
  constraint, not a local one.
- `loadRouteFromGpxText` had to take `epsilon`/`maxGap` as explicit
  parameters instead of reading component state directly, since the
  mount-restore-from-localStorage path needs to parse with just-loaded
  stored values before React re-renders with them applied.
