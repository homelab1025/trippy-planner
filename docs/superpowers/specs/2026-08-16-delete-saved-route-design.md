# Delete a Saved Route — Design Spec

**Date:** 2026-08-16

## Context

`MyRoutesPanel.tsx` already lets a signed-in user list, load, and duplicate saved routes (`frontend/src/components/MyRoutesPanel.tsx`). There's no way to delete one. The backend and API contract already support it: `DELETE /routes/{id}` is defined in `openapi.yaml` (operation `deleteRoute`) and the generated client already exposes `routesApi.deleteRoute(id)` (`frontend/src/api/api.ts:346,595`) — no backend or OpenAPI changes are needed, this is a frontend-only feature.

## Design

### 1. `ConfirmDialog.tsx` (new, generic)

A modal styled like `SignInPanel.tsx` — same `modal`/`modal-box`/close-✕/backdrop-click-to-cancel structure — but generic rather than sign-in-specific, so it can be reused by future destructive actions:

```ts
interface Props {
  open: boolean;
  title: string;
  message: string;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

- Two buttons: `Cancel` (`btn-ghost`) and `OK` (`btn-error`, since the only current use is destructive). While `confirming` is true, `OK` reads "Deleting…" and both buttons are disabled — mirroring `SignInPanel`'s `state === 'sending'` disable pattern.
- Backdrop click and the ✕ button call `onCancel` (no-op while `confirming`).
- Unlike `SignInPanel`, this component is stateless/controlled — no internal `open`/`prevOpen` tracking — since the caller (`MyRoutesPanel`) already needs to track *which* route is pending deletion.

### 2. `MyRoutesPanel.tsx` changes

- Add a `Trash2` icon button (lucide-react) next to the existing `Copy` button, same `btn btn-ghost btn-xs px-1` styling, `aria-label={`Delete ${name}`}`.
- Clicking it sets local state `pendingDelete: { id, name, startTime } | null` and renders `ConfirmDialog` with:
  - `title="Delete route"`
  - `message={`Delete '${name}' on the ${format(new Date(startTime), 'd MMM yyyy')}?`}` — using the `date-fns` `format` helper already used in `App.tsx` (`'d MMM yyyy HH:mm'` pattern for timestamps; here just the date portion since only the ride date is relevant).
- On confirm: call `routesApi.deleteRoute(id)`, then `await fetchRoutes()` to refresh the list, then clear `pendingDelete`, then call a new `onDeleted(id)` prop.
- On cancel: clear `pendingDelete`, no API call.
- Clicking the trash icon calls `e.stopPropagation()` (same as the duplicate button) so it doesn't trigger the row's load-route click handler.

### 3. `App.tsx` changes

New prop wired into the existing `<MyRoutesPanel>` call (`App.tsx:524`):

```ts
onDeleted={(id) => {
  if (id === savedRouteId) {
    setRoute(null);
    setRawGpxContent(null);
    setRouteName('');
    setSavedRouteId(null);
    clearStoredRoute();
  }
}}
```

Per the confirmed behavior: deleting the route currently loaded in the main view (map + elevation chart) resets the app to the empty state, since the route no longer exists — this avoids leaving `SaveRouteButton`/`ShareToggle` pointed at a deleted ID. `clearStoredRoute()` (already imported, `services/routeStorage.ts`) prevents the deleted route from reappearing via the `localStorage` mirror on next reload. Deleting a route that is *not* currently loaded only updates the list — the main view is untouched.

### 4. Error handling

No existing component in this codebase catches or surfaces API errors — `SaveRouteButton` and `ShareToggle` let promise rejections propagate bare. `ConfirmDialog`/`MyRoutesPanel` follow the same convention; no new toast/error-banner pattern is introduced here.

## Testing

- New `ConfirmDialog.test.tsx` (styled after `SignInPanel.test.tsx`): renders when `open`, hidden when not; clicking OK calls `onConfirm`; clicking Cancel/backdrop/✕ calls `onCancel`; buttons disabled and OK shows "Deleting…" when `confirming`.
- Extend `MyRoutesPanel.test.tsx`:
  - Clicking the delete icon opens the dialog with the expected message text (route name + formatted `startTime`).
  - Confirming calls `routesApi.deleteRoute(id)`, refetches the list, and calls `onDeleted(id)`.
  - Cancelling closes the dialog without calling `deleteRoute`.
  - Clicking the delete icon does not trigger `onLoadRoute` (row click handler).

## Out of scope

- Bulk/multi-select delete.
- Undo/soft-delete — `DELETE /routes/{id}` is already a hard delete server-side; no change to that contract.
