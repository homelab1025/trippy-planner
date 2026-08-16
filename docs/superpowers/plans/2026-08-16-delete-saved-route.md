# Delete a Saved Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user delete a saved route from the "My routes" panel, behind a confirmation dialog, and clear the main view if the deleted route was the one currently loaded.

**Architecture:** Frontend-only change (backend `DELETE /routes/{id}` already exists). A new generic `ConfirmDialog` component (styled like `SignInPanel`) is added, wired into `MyRoutesPanel` behind a new trash icon next to the existing duplicate icon, and `App.tsx` clears its route state when the deleted route is the currently-loaded one.

**Tech Stack:** React + TypeScript, Vitest + Testing Library for unit tests, Playwright for E2E, `date-fns` for date formatting, `lucide-react` for icons, DaisyUI/Tailwind for modal styling.

## Global Constraints

- Follow `contributing/styleguide/typescript.md`: explicit semicolons, single quotes, named exports, no `any`, `const`-by-default. New files (`ConfirmDialog.tsx` and its test) follow this fully. Edits to `MyRoutesPanel.tsx` match that file's existing local convention (no semicolons) for consistency within the file, per this project's "follow existing patterns" norm.
- No new error-handling/toast pattern — match `SaveRouteButton`/`ShareToggle`, which let promise rejections propagate bare.
- Delete confirmation message format (from spec): `Delete '{name}' on the {startTime formatted as 'd MMM yyyy'}?`
- Deleting the currently-loaded route resets `App.tsx`'s route state to empty and clears the `localStorage` mirror (`clearStoredRoute()`); deleting any other route only updates the list.
- Spec: `docs/superpowers/specs/2026-08-16-delete-saved-route-design.md`

---

### Task 1: `ConfirmDialog` component

**Files:**
- Create: `frontend/src/components/ConfirmDialog.tsx`
- Test: `frontend/src/components/ConfirmDialog.test.tsx`

**Interfaces:**
- Produces: `ConfirmDialog(props: { open: boolean; title: string; message: string; confirming: boolean; onConfirm: () => void; onCancel: () => void }): JSX.Element | null` — a controlled, stateless modal. Later tasks (`MyRoutesPanel`) import this as `import { ConfirmDialog } from './ConfirmDialog';`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/ConfirmDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete route"
        message="Delete 'Alpine Loop' on the 17 Jun 2026?"
        confirming={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText('Delete route')).not.toBeInTheDocument();
  });

  it('shows title and message when open', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete route"
        message="Delete 'Alpine Loop' on the 17 Jun 2026?"
        confirming={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Delete route')).toBeInTheDocument();
    expect(screen.getByText("Delete 'Alpine Loop' on the 17 Jun 2026?")).toBeInTheDocument();
  });

  it('calls onConfirm when OK is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete route"
        message="msg"
        confirming={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete route"
        message="msg"
        confirming={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when the close button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete route"
        message="msg"
        confirming={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables both buttons and shows "Deleting…" while confirming', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete route"
        message="msg"
        confirming={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/ConfirmDialog.test.tsx`
Expected: FAIL — `Cannot find module './ConfirmDialog'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/ConfirmDialog.tsx`:

```tsx
interface Props {
  open: boolean;
  title: string;
  message: string;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirming, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box relative">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          aria-label="Close"
          onClick={onCancel}
          disabled={confirming}
        >
          ✕
        </button>
        <h3 className="font-bold text-lg mb-3">{title}</h3>
        <p className="text-sm mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={confirming}>
            Cancel
          </button>
          <button className="btn btn-error btn-sm" onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Deleting…' : 'OK'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={confirming ? undefined : onCancel} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/ConfirmDialog.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ConfirmDialog.tsx frontend/src/components/ConfirmDialog.test.tsx
git commit -m "feat(frontend): add generic ConfirmDialog component"
```

---

### Task 2: Wire delete into `MyRoutesPanel`

**Files:**
- Modify: `frontend/src/components/MyRoutesPanel.tsx`
- Test: `frontend/src/components/MyRoutesPanel.test.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` from Task 1 (`open`, `title`, `message`, `confirming`, `onConfirm`, `onCancel`); `routesApi.deleteRoute(id: string): Promise<{data: void}>` (already generated, `frontend/src/api/api.ts:595`); `date-fns`'s `format(date: Date, pattern: string): string` (already used in `App.tsx:4,75`).
- Produces: `MyRoutesPanel` gains a new required prop `onDeleted: (id: string) => void`, called after a successful delete (and after the list has been refetched). Task 3 (`App.tsx`) consumes this exact prop name and signature.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/components/MyRoutesPanel.test.tsx` — first extend the hoisted mocks and default `onDeleted` prop used by every existing `render(<MyRoutesPanel .../>)` call in the file (add `onDeleted={vi.fn()}` to each existing render call so they keep compiling once the prop becomes required), add a `format` import from `date-fns` at the top of the file, then add:

```tsx
// at the top of the file, alongside the existing imports:
import { format } from 'date-fns'

// derive the expected message the same way the component does, so the
// assertion doesn't hardcode a timezone-dependent date string:
const expectedDate = format(new Date(sampleItems[0].startTime), 'd MMM yyyy')

// in the `mocks` vi.hoisted(() => ({...})) block, add:
  deleteRoute: vi.fn(),

// new tests at the end of the describe block:
  it('opens a confirm dialog with the route name and formatted date when the delete icon is clicked', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })

    render(<MyRoutesPanel onLoadRoute={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByRole('button', { name: /delete alpine loop/i }))

    expect(screen.getByText(`Delete 'Alpine Loop' on the ${expectedDate}?`)).toBeInTheDocument()
  })

  it('does not trigger onLoadRoute when the delete icon is clicked', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })

    const onLoadRoute = vi.fn()
    render(<MyRoutesPanel onLoadRoute={onLoadRoute} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByRole('button', { name: /delete alpine loop/i }))

    expect(onLoadRoute).not.toHaveBeenCalled()
  })

  it('deletes the route, refreshes the list, and calls onDeleted when confirmed', async () => {
    mocks.listRoutes
      .mockResolvedValueOnce({ data: sampleItems }) // initial mount
      .mockResolvedValueOnce({ data: [] }) // after delete
    mocks.deleteRoute.mockResolvedValue({})

    const onDeleted = vi.fn()
    render(<MyRoutesPanel onLoadRoute={vi.fn()} onDeleted={onDeleted} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByRole('button', { name: /delete alpine loop/i }))
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }))

    await waitFor(() => {
      expect(mocks.deleteRoute).toHaveBeenCalledWith('uuid-1')
      expect(onDeleted).toHaveBeenCalledWith('uuid-1')
    })
    await waitFor(() => {
      expect(screen.queryByText('Alpine Loop')).not.toBeInTheDocument()
    })
  })

  it('does not delete the route when the dialog is cancelled', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })

    render(<MyRoutesPanel onLoadRoute={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByRole('button', { name: /delete alpine loop/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(mocks.deleteRoute).not.toHaveBeenCalled()
    expect(screen.queryByText(`Delete 'Alpine Loop' on the ${expectedDate}?`)).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/MyRoutesPanel.test.tsx`
Expected: FAIL — `onDeleted` is not a valid prop / delete button not found (TypeScript compile error and/or missing element).

- [ ] **Step 3: Write the implementation**

Replace the full contents of `frontend/src/components/MyRoutesPanel.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { routesApi } from '../apiClient'
import type { RouteListItem } from '../api'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  onLoadRoute: (gpxContent: string, avgSpeedKmh: number, startTime: string, id: string, name: string) => void
  onDeleted: (id: string) => void
  refreshKey?: string
}

const NOT_FETCHED = Symbol('not-fetched')

export function MyRoutesPanel({ onLoadRoute, onDeleted, refreshKey }: Props) {
  const [routes, setRoutes] = useState<RouteListItem[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | typeof NOT_FETCHED | undefined>(NOT_FETCHED)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string; startTime: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const loading = fetchedFor !== refreshKey

  const fetchRoutes = useCallback(async () => {
    const res = await routesApi.listRoutes()
    setRoutes(res.data)
  }, [])

  useEffect(() => {
    let cancelled = false
    routesApi.listRoutes()
      .then(res => { if (!cancelled) setRoutes(res.data) })
      .finally(() => { if (!cancelled) setFetchedFor(refreshKey) })
    return () => { cancelled = true }
  }, [refreshKey])

  async function handleClick(id: string, avgSpeedKmh: number, startTime: string, name: string) {
    const res = await routesApi.getRoute(id)
    onLoadRoute(res.data.gpxContent as string, avgSpeedKmh, startTime, id, name)
  }

  async function handleDuplicate(e: React.MouseEvent, id: string, name: string, avgSpeedKmh: number, startTime: string) {
    e.stopPropagation()
    const res = await routesApi.getRoute(id)
    await routesApi.createRoute({
      name: `${name} (copy)`,
      gpxContent: res.data.gpxContent as string,
      avgSpeedKmh,
      startTime,
    })
    await fetchRoutes()
  }

  function handleDeleteClick(e: React.MouseEvent, id: string, name: string, startTime: string) {
    e.stopPropagation()
    setPendingDelete({ id, name, startTime })
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    await routesApi.deleteRoute(pendingDelete.id)
    await fetchRoutes()
    setDeleting(false)
    const id = pendingDelete.id
    setPendingDelete(null)
    onDeleted(id)
  }

  function handleCancelDelete() {
    setPendingDelete(null)
  }

  if (loading) return <p className="text-sm text-base-content/50">Loading routes…</p>
  if (routes.length === 0) return <p className="text-sm text-base-content/50">No saved routes yet.</p>

  return (
    <>
      <ul className="menu menu-sm w-full min-w-0">
        {routes.map(r => {
          const id = r.id as string
          const name = r.name as string
          const avgSpeedKmh = r.avgSpeedKmh as number
          const startTime = r.startTime as string
          return (
            <li key={id} className="min-w-0">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                <button
                  className="text-left grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-w-0"
                  onClick={() => handleClick(id, avgSpeedKmh, startTime, name)}
                >
                  <span className="truncate block min-w-0" title={name}>{name}</span>
                  <span className="text-xs text-base-content/50">{avgSpeedKmh} km/h</span>
                </button>
                <button
                  aria-label={`Duplicate ${name}`}
                  className="btn btn-ghost btn-xs px-1"
                  onClick={(e) => handleDuplicate(e, id, name, avgSpeedKmh, startTime)}
                >
                  <Copy size={14} />
                </button>
                <button
                  aria-label={`Delete ${name}`}
                  className="btn btn-ghost btn-xs px-1"
                  onClick={(e) => handleDeleteClick(e, id, name, startTime)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete route"
        message={pendingDelete ? `Delete '${pendingDelete.name}' on the ${format(new Date(pendingDelete.startTime), 'd MMM yyyy')}?` : ''}
        confirming={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/MyRoutesPanel.test.tsx`
Expected: PASS (all existing + 4 new tests)

- [ ] **Step 5: Update the `App.tsx` call site so the app still compiles**

`App.tsx:524` currently calls `<MyRoutesPanel onLoadRoute={...} refreshKey={...} />` without `onDeleted`, which now fails to type-check. Add a temporary no-op so Task 2 compiles standalone (Task 3 replaces this with the real callback):

Edit `frontend/src/App.tsx` around line 524:

```tsx
                <MyRoutesPanel
                  onLoadRoute={(gpxContent, avgSpeedKmh, startTime, id, name) => {
                    const start = new Date(startTime)
                    setAvgSpeed(avgSpeedKmh)
                    setStartTime(start)
                    setRouteName(name)
                    setSavedRouteId(id)
                    loadRouteFromGpxText(gpxContent, avgSpeedKmh, start)
                  }}
                  onDeleted={() => {}}
                  refreshKey={savedRouteId ? `${savedRouteId}:${routesRefreshToken}` : undefined}
                />
```

Run: `cd frontend && npm run build`
Expected: type-check passes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/MyRoutesPanel.tsx frontend/src/components/MyRoutesPanel.test.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add delete action with confirmation to My Routes panel"
```

---

### Task 3: Clear the current view when the loaded route is deleted

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `MyRoutesPanel`'s `onDeleted: (id: string) => void` prop (Task 2); existing `App.tsx` state setters `setRoute`, `setRawGpxContent`, `setRouteName`, `setSavedRouteId`; existing `clearStoredRoute()` from `./services/routeStorage` (already imported at `App.tsx:11`); existing `savedRouteId` state.

- [ ] **Step 1: Replace the placeholder `onDeleted` with the real callback**

Edit `frontend/src/App.tsx`, replacing the `onDeleted={() => {}}` placeholder added in Task 2 (around line 531):

```tsx
                  onDeleted={(id) => {
                    if (id === savedRouteId) {
                      setRoute(null)
                      setRawGpxContent(null)
                      setRouteName('')
                      setSavedRouteId(null)
                      clearStoredRoute()
                    }
                  }}
```

(Match this block's existing local indentation/semicolon style in `App.tsx` — the surrounding `onLoadRoute` callback in the same prop list already uses no trailing semicolons on statements inside its body; mirror that.)

- [ ] **Step 2: Manually verify with the dev server**

Run: `cd frontend && npm run dev` (or reuse a running instance)
- Sign in, upload a GPX, save it, confirm it's the loaded route.
- Open "My routes", click the trash icon next to the loaded route, confirm the dialog appears with the correct name/date, click OK.
- Expected: the route disappears from the list AND the main view resets to the "Upload a GPX file to see your route" empty state.
- Repeat: save two routes, load route A, delete route B from the list (not the loaded one).
- Expected: route B disappears from the list; route A stays loaded and visible in the main view, unaffected.

- [ ] **Step 3: Run the full unit test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 4: Run the build/type-check**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): clear current view when the loaded route is deleted"
```

---

### Task 4: Playwright E2E coverage

**Files:**
- Modify: `frontend/tests/my-routes.spec.ts`

**Interfaces:**
- Consumes: existing `cleanRoutes(page: Page)` helper and `createAuthenticatedSession()` from `frontend/tests/helpers/testAuth.ts`, already used by every test in this file.

- [ ] **Step 1: Add the E2E tests**

Append to the `test.describe('My Routes panel', ...)` block in `frontend/tests/my-routes.spec.ts`, before the final closing `});`:

```ts
  test('deleting the currently loaded route clears the main view', async ({ page }) => {
    await cleanRoutes(page);

    await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);

    await page.getByText('My routes').click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /Delete Sample Ride/i }).click();
    await expect(page.getByText(/Delete 'Sample Ride' on the/)).toBeVisible();
    await page.getByRole('button', { name: /^OK$/ }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.header-stats')).toHaveCount(0);
    await expect(page.getByText('Upload a GPX file to see your route')).toBeVisible();
    await expect(page.getByText('No saved routes yet.')).toBeVisible();
  });

  test('cancelling the delete dialog keeps the route', async ({ page }) => {
    await cleanRoutes(page);

    await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);

    await page.getByText('My routes').click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /Delete Sample Ride/i }).click();
    await expect(page.getByText(/Delete 'Sample Ride' on the/)).toBeVisible();
    await page.getByRole('button', { name: /Cancel/i }).click();

    const myRoutesPanel = page.locator('text=My routes').locator('..').locator('..');
    const items = await myRoutesPanel.locator('li').all();
    expect(items).toHaveLength(1);
    expect(await items[0].textContent()).toContain('Sample Ride');
    // The still-loaded route in the main view is untouched.
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');
  });
```

- [ ] **Step 2: Run the new E2E tests**

Run: `cd frontend && npx playwright test my-routes.spec.ts -g "delet"`
Expected: PASS (both new tests; existing tests in the file unaffected since `mode: 'serial'` is already configured and each test calls `cleanRoutes` first).

- [ ] **Step 3: Run the full Playwright suite for this file**

Run: `cd frontend && npx playwright test my-routes.spec.ts`
Expected: PASS, all 7 tests (5 existing + 2 new).

- [ ] **Step 4: Commit**

```bash
git add frontend/tests/my-routes.spec.ts
git commit -m "test(frontend): add E2E coverage for deleting a saved route"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend unit test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, no regressions in any file.

- [ ] **Step 2: Run lint**

Run: `cd frontend && npm run lint`
Expected: PASS, no new warnings/errors.

- [ ] **Step 3: Run the full build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 4: Run the full Playwright suite**

Run: `cd frontend && npx playwright test`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit the spec if not already committed**

```bash
git add docs/superpowers/specs/2026-08-16-delete-saved-route-design.md docs/superpowers/plans/2026-08-16-delete-saved-route.md
git commit -m "docs: add spec and plan for delete-saved-route feature"
```
