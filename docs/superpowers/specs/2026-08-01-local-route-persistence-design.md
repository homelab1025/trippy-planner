# Persist the Working Route Locally; Decouple Login from Saving — Design Spec

**Date:** 2026-08-01
**Issue:** #44 ("when saving route the first time, account is created, but route not saved")
**Related:** #46 (use `updateRoute` on re-save), #47 (invalidate superseded magic-link tokens) — both deferred out of this spec

## Context

This builds on the auth/persistence layer introduced in `2026-06-17-auth-backend-design.md`. That spec's own security note flagged the tradeoff being hit here: "the token is visible in the email link... accepted for simplicity at this stage."

## Root cause of #44

Magic-link authentication requires a full browser navigation — the user clicks a link in their email client, which loads `index.html` from scratch. Per this app's architecture (no global state library; all state lives in `App.tsx`), that reload wipes every in-memory field: `route`, `rawGpxContent`, `avgSpeed`, `startTime`.

The current flow embeds the email/magic-link prompt inside `SaveRouteButton` (`frontend/src/components/SaveRouteButton.tsx:17-32`): clicking "Save route" while logged out swaps to an email form. Submitting it calls `POST /auth/magic-link`, which — via `UserRepository.findOrCreate` (`backend/src/main/java/com/trippyplanner/auth/UserRepository.java:17-26`) — creates the account immediately. The route being "saved" was never sent anywhere; it only existed in React state. When the user clicks the emailed link and the page reloads, that state is gone, so there's nothing left to save even though the account now exists.

## Design

### 1. Local route storage module

New `frontend/src/services/routeStorage.ts`, storing the same shape as `CreateRouteRequest` (`name`, `gpxContent`, `avgSpeedKmh`, `startTime`) under a single `localStorage` key:

```ts
function loadStoredRoute(): StoredRoute | null
function saveStoredRoute(route: StoredRoute): void
function clearStoredRoute(): void
```

- `saveStoredRoute` wraps `localStorage.setItem` in try/catch (quota exceeded, private-browsing restrictions in some browsers). On failure: log a console warning, continue without persistence for that session — the app must not crash.
- `loadStoredRoute` wraps `JSON.parse` in try/catch. Corrupted or invalid JSON is treated as "nothing stored" and the bad key is cleared, not thrown.

### 2. `App.tsx` integration

The existing "runs once on mount" effect (`App.tsx:233-270`, which already handles `?token=` landing and shared-route loading) gains a third branch: if the URL is not a `/share/...` path, call `loadStoredRoute()`. If it returns a route, feed it through the **existing** `loadRouteFromGpxText(gpxContent, avgSpeedKmh, startTime)` path — the same function already used for file upload (`handleFileUpload`) and "load from account" (`MyRoutesPanel.onLoadRoute`). No new parsing or weather-fetch logic is introduced.

A new `useEffect` watches `rawGpxContent`, `avgSpeed`, and `startTime`, calling `saveStoredRoute` on change. It's skipped while `isViewingShared` is true, so opening someone else's share link doesn't overwrite the viewer's own working route in storage.

Because `MyRoutesPanel.onLoadRoute` (`App.tsx:480-485`) sets the same state fields, loading a saved route from the account flows through the same setters and is automatically mirrored to local storage — no special-case code needed.

### 3. Decoupling login from saving

- **`SaveRouteButton`** is reduced to one job: if `isAuthenticated`, call `createRoute` directly (unchanged). If not, call a new `onRequireAuth: () => void` prop instead of switching to its own email-prompt state. All email/sending/sent state and UI is removed from this component.
- **New `SignInPanel` component** owns the email input, "Send link" button, and "Check your email" confirmation — this is the code moved out of `SaveRouteButton`, relocated to a shared, reusable place. Rendered as a modal/panel, opened imperatively (e.g. `App.tsx` holds a boolean `signInOpen` state).
- **`AuthHeader`** (`frontend/src/components/AuthHeader.tsx`) gains a "Sign in" button rendered when `!user`, calling the same `onRequireAuth`/open-panel callback. This is the only way to reach login when no route is loaded at all, and it works identically whether or not a route is currently loaded.

### 4. Data flow after these changes

1. Anonymous user uploads a GPX. `route`/`rawGpxContent` are set as today, and now also mirrored to `localStorage`.
2. User clicks "Save route." Unauthenticated → `SignInPanel` opens (triggered from `SaveRouteButton`, not owned by it).
3. User submits their email. `POST /auth/magic-link` is called with only `{email}` — no route data is ever sent or referenced here, so there is nothing route-shaped to lose.
4. User clicks the emailed link. Full-page reload occurs. The mount effect processes `?token=` (existing, unchanged) and rehydrates the route from `localStorage` (new) in the same pass.
5. User is now authenticated with their route back on screen, and clicks "Save route" again themselves.

Auto-saving immediately after step 4 was considered and rejected: it would fire an API call the user never explicitly triggered on that page load. Since the route no longer disappears, requiring one more explicit click is a small, predictable cost in exchange for not surprising the user with a silent write.

## Testing

- Unit tests for `routeStorage.ts`: save/load/clear round-trip; corrupted-JSON on read is treated as empty; a `setItem` throw doesn't propagate.
- `SaveRouteButton.test.tsx`: drop the email-flow cases (moving to `SignInPanel.test.tsx`); keep "authenticated → calls `createRoute`"; add "unauthenticated → calls `onRequireAuth`, does not call `createRoute`."
- New `SignInPanel.test.tsx` covering the email/magic-link request states.
- New Playwright E2E test reproducing #44 directly: upload a GPX, open sign-in, use the existing test backdoor (`frontend/tests/helpers/testAuth.ts`, backed by `GET /test/magic-link-token`) to obtain a real token without needing an inbox, navigate to `/?token=...` (simulating the email-link reload), and assert the route is still rendered and "Save route" now succeeds.

## Out of scope (filed separately)

- **#46** — `SaveRouteButton` always calls `createRoute`, even for a route already saved in a prior session; never calls the existing `updateRoute` (PUT). Out of scope here because there's currently no reliable way to know "this loaded route already has ID X" across page loads, and today's codebase has no `updateRoute` caller anywhere to build on.
- **#47** — the magic-link token doubles as the long-lived session token (`AuthController.java:38-49`, `SessionRepository.findValidSessionTokenByUserId`), so a previously emailed link keeps working until natural expiry (30 days) even after a new one is requested. Two options were scoped there (supersede-on-request vs. splitting magic-link/session tokens) and deferred, since neither is required to fix #44.
