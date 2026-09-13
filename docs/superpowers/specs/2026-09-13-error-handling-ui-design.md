# Unified Error-Handling UI — Design Spec

**Date:** 2026-09-13
**Issue:** #54 — "Add unified error-handling UI to clearly inform users of failures"

## Context

Error handling today is inconsistent and mostly invisible, per the issue's survey of the frontend:

- GPX upload is the only path with any feedback at all, and it's a blocking native `alert()`.
- Weather fetch failures are swallowed silently (`console.error` only) — the timeline just goes empty.
- A failed magic-link request leaves the sign-in button stuck on "Sending…" forever; sign-out errors are discarded.
- None of the saved-route calls (save/load/duplicate/delete/share/unshare) have a `try`/`catch` — a failure is an unhandled promise rejection, and the triggering button can stay in a loading state indefinitely.
- `apiClient.ts` has no response interceptor and no centralized 401/5xx handling.
- There's no shared UI primitive anywhere in `src/` to surface any of this.

This spec introduces that shared primitive and wires it into every path the issue calls out.

## Design

### 1. `frontend/src/services/errorBus.ts` (new)

A minimal module-level pub/sub store — not React Context — so plain modules outside the component tree (`apiClient.ts`, `weatherProviders/openMeteo.ts`) can report an error without prop drilling or needing to be inside a provider.

```ts
export interface ErrorEntry {
  id: number;
  message: string;
}

export function reportError(message: string): void;
export function dismissError(id: number): void;
export function subscribeErrors(listener: (entries: ErrorEntry[]) => void): () => void;
```

Internal state is a single `ErrorEntry[]` plus an incrementing `id` counter, module-scoped. `subscribeErrors` immediately calls the listener with the current snapshot on subscribe (so a component mounting after an error was already reported still sees it), then again on every change. No cap on entry count and no auto-dismiss — both explicitly out of scope per the approved design (manual dismiss only, stack rather than replace).

### 2. `frontend/src/services/sessionEvents.ts` (new)

A second, narrower emitter for one specific cross-cutting concern: telling `App.tsx` that the session was invalidated server-side, from inside the axios interceptor (a plain module, not a component).

```ts
export function notifySessionExpired(): void;
export function onSessionExpired(listener: () => void): () => void;
```

Kept separate from `errorBus` rather than folded in — it drives auth *state* (`setUser(null)`), not error *display*; conflating the two would make `ErrorPanel` (or anything else subscribing to errors) responsible for auth side effects it has no business doing.

### 3. `frontend/src/components/ErrorPanel.tsx` (new)

```ts
export function ErrorPanel(): JSX.Element | null
```

Subscribes to `errorBus` via `useEffect(() => subscribeErrors(setEntries), [])`. Renders `null` when there are no entries (so it takes up no layout space when quiet). Otherwise renders a `flex flex-col gap-2` stack, one daisyUI `alert alert-error shadow` per entry, each with its message and a `✕` dismiss button (same visual pattern as `SignInPanel`'s modal close button) wired to `dismissError(entry.id)`.

This is its own independent panel — not merged into daisyUI's `toast` overlay system or any existing card — placed as the **first child** of the sidebar's flex column in `App.tsx` (`<div className="flex flex-col overflow-y-auto lg:pt-7">`), immediately before the "Ride Details" card. Because the sidebar is a normal-flow flex column, the panel pushes every other card down while present and disappears (collapses its space) once every entry is dismissed — matching "positioned higher than all panels, others shift lower" from the approved design, without needing fixed positioning or a z-index.

### 4. `apiClient.ts` — response interceptor

Add a response interceptor to `axiosInstance` alongside the existing request interceptor:

- **No response** (network error / timeout — `error.response` is undefined): `reportError('Network error — please check your connection and try again.')`
- **401**: `clearToken()`, `notifySessionExpired()`, `reportError('Your session has expired. Please sign in again.')`
- **5xx**: `reportError('Something went wrong on our end. Please try again.')`
- **other 4xx**: no auto-report — left to the call site, since these are often expected/context-dependent (e.g. an invalid share token deliberately fails silently today).

Always re-throws (`return Promise.reject(error)`), so every existing and newly-added `try`/`catch` downstream still runs. `App.tsx` subscribes to `onSessionExpired` in its existing mount effect and calls `setUser(null)`.

**Accepted trade-off:** because call sites (section 5) also report their own specific message on failure, a single network/5xx failure on a call site that has its own catch can surface two stacked entries — the interceptor's generic one and the call site's specific one. This is the direct, explicit consequence of the approved choice ("interceptor shows generic, call sites add specifics") over suppressing one in favor of the other, which would need the call site to inspect the error's status code to know whether the interceptor already handled it. Not solved here; flagged so it isn't mistaken for a bug later.

### 5. Call-site wiring

Every mutating call below gets a `try`/`catch`/`finally` so failure always (a) resets whatever loading/disabled state it set and (b) reports a specific message. Messages are short and actionable, no error codes or stack traces.

- **`App.tsx` `handleFileUpload`** (GPX parse — local/sync, not through `apiClient`): existing `catch`'s `alert(message)` becomes `reportError(message)`. `message` keeps its existing derivation (parse error's own message, or the "Failed to parse GPX file…" fallback).
- **`App.tsx` `updateWeather`**: existing `catch` (weather providers use `fetch`, not axios, so the interceptor doesn't cover this) adds `reportError("Couldn't fetch weather for this route. Try refreshing.")`. Still returns `false`; existing "unavailable" UI handling of empty `weatherPoints` is unchanged.
- **`App.tsx` mount effect, stored-route restore**: the existing `.catch(() => clearStoredRoute())` gets `reportError("Couldn't restore your last route. Please re-upload it.")` added before clearing storage.
- **`App.tsx` sign-out handler**: keep clearing the local token/`user` unconditionally (already correct — don't block local sign-out on a flaky server), but the `catch` (currently discards the error) adds `reportError("Couldn't reach the server to end your session, but you've been signed out locally.")`.
- **`SignInPanel.tsx` `handleSendLink`**: wrap the existing `await authApi.requestMagicLink(...)` in `try`/`catch`. On failure: `reportError("Couldn't send the sign-in link. Please try again.")` and `setState('idle')` (today it has no catch at all and gets stuck on `'sending'` forever on failure).
- **`SaveRouteButton.tsx` `handleSave`**: wrap the existing body in `try`/`catch`/`finally`. `finally` always `setState('idle')` (today only the success path resets it). `catch` reports `"Couldn't save the route. Please try again."`.
- **`ShareToggle.tsx`**: currently has no loading state at all. Adds a minimal `busy` boolean, set for the duration of `handleShare`/`handleUnshare`, disabling the Share/Stop sharing button while in flight. Both handlers get `try`/`catch`/`finally`; `catch` reports `"Couldn't create a share link. Please try again."` / `"Couldn't stop sharing. Please try again."` respectively. The `navigator.clipboard.writeText` call also gets wrapped, reporting `"Couldn't copy the link — please copy it manually."` on rejection (permissions-denied clipboard is a real, currently-unhandled failure mode here).
- **`MyRoutesPanel.tsx`**:
  - `fetchRoutes` / the mount `useEffect`'s `routesApi.listRoutes()` call: add `.catch` reporting `"Couldn't load your saved routes. Please try again."`. The `finally` that clears the loading flag is unchanged, so the panel falls through to its existing "No saved routes yet." empty state after a failed fetch — good enough for this pass; a dedicated error-vs-empty distinction is out of scope (see below).
  - `handleClick` (load a route): wrap in `try`/`catch` reporting `"Couldn't load that route. Please try again."`.
  - `handleDuplicate`: wrap in `try`/`catch` reporting `"Couldn't duplicate the route. Please try again."`.
  - `handleConfirmDelete`: wrap in `try`/`catch`/`finally`. `finally` always `setDeleting(false)`. On failure, `reportError("Couldn't delete the route. Please try again.")` and leave `pendingDelete` set so the confirm dialog stays open (retry or cancel), instead of the current code's unconditional close.

## Testing

- `errorBus.test.ts` (new): `reportError` adds an entry and notifies subscribers; `dismissError` removes only the matching entry; a listener subscribing after an entry exists receives it immediately; multiple `reportError` calls stack rather than replace.
- `sessionEvents.test.ts` (new): `notifySessionExpired` calls all registered listeners; a listener can unsubscribe.
- `ErrorPanel.test.tsx` (new): renders nothing with no entries; renders one alert per entry; clicking a dismiss button removes only that entry.
- `apiClient.test.ts` (extended): response interceptor reports the network-error message when `error.response` is undefined, the session-expired message plus `clearToken`/`notifySessionExpired` on 401, and the generic 5xx message on a 500 — and in all three cases still rejects the promise so the caller's own `catch` observes the error.
- `SignInPanel.test.tsx`, `SaveRouteButton.test.tsx`, `ShareToggle.test.tsx`, `MyRoutesPanel.test.tsx` (extended): each gains a failure-path test asserting (a) the loading/disabled state resets and (b) `reportError` was called with the expected message — mocking `../services/errorBus` the same way these files already mock `../apiClient`.
- `App.test.tsx` (extended): GPX parse failure reports instead of calling `alert`; a 401 from a background call clears `user`.

## Out of scope

- Distinguishing "failed to load" from "genuinely empty" in `MyRoutesPanel`'s list state — a failed fetch currently falls through to the existing "No saved routes yet." message alongside the new error-panel entry. A dedicated inline error state for that panel is a reasonable follow-up but not required by the issue.
- Retry affordances (buttons on the error entries themselves) — the issue's proposal explicitly leaves this open; none of the approved answers asked for it, and every failure path already has its own retry mechanism (re-click Save, re-submit the sign-in form, etc.).
- Capping the number of stacked error entries — not asked for; can be revisited if it becomes a real problem.
- Suppressing the interceptor's generic message when a call site's own specific message will also fire (see the accepted trade-off in section 4).
