# ADR: Mirror the working route to localStorage; decouple sign-in from Save

**Date:** 2026-08-03
**Status:** Accepted
**Related:** [FDR: Persist working route across sign-in, decouple sign-in from saving](../fdr/2026-08-03-persist-route-across-signin.md), [design spec](../superpowers/specs/2026-08-01-local-route-persistence-design.md)

## Context

Magic-link auth requires a full browser navigation when the user clicks the
emailed link — a fresh `index.html` load. Since all app state lives in
`App.tsx` with no global state library, that reload wiped `route`,
`rawGpxContent`, `avgSpeed`, and `startTime`. A user who uploaded a GPX,
clicked "Save route," and completed the magic-link flow came back to find
their work gone and nothing to save (issue #44) — even though the account
had already been created via `POST /auth/magic-link`.

## Decision

- New `routeStorage.ts` mirrors the working route's shape (`name`,
  `gpxContent`, `avgSpeedKmh`, `startTime`) to a single `localStorage` key.
  A `useEffect` watching those state fields writes on every change; the
  existing mount effect reads it back (skipped when viewing a `/share/...`
  route, so opening someone else's shared route never overwrites the
  viewer's own working copy).
- Both reads and writes wrap `localStorage`/`JSON.parse` in try/catch:
  quota errors, private-browsing restrictions, or corrupted JSON degrade to
  "nothing stored" with a console warning, never a crash.
- The rehydrated route flows through the same `loadRouteFromGpxText` path
  already used for file upload and "load from account" — no parallel
  loading logic.
- `SaveRouteButton` no longer owns the email/magic-link UI; it calls a new
  `onRequireAuth` callback when unauthenticated. That UI moves to a new,
  independent `SignInPanel`, reachable both from `SaveRouteButton` and a new
  always-visible "Sign in" control in `AuthHeader`.

## Alternatives considered

- **Auto-save immediately after the post-magic-link reload** — rejected;
  it would fire an API call the user never explicitly triggered on that
  page load. Since the route no longer disappears, requiring one more
  explicit "Save route" click was judged a small, predictable cost against
  surprising the user with a silent write.

## Consequences

- The working route now has two homes that must stay in sync by
  construction: in-memory `App.tsx` state and its `localStorage` mirror.
  Any new code path that sets route state outside the watched fields won't
  be mirrored automatically.
- Sign-in is now reachable independent of any save action, which is a
  precondition the later ["update instead of duplicate" save fix](2026-08-14-saved-route-identity-tracking.md)
  builds on.
- This spec explicitly deferred two related issues that remain open
  follow-ups: #46 (Save always creates rather than updates an
  already-saved route — later addressed) and #47 (a superseded magic-link
  token keeps working until natural expiry, since the link token doubles
  as the session token).
