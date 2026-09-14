# Unified Error-Handling UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the frontend a shared, dismissible error panel and wire every currently-silent-or-blocking failure path (GPX upload, weather fetch, auth, saved routes, apiClient) into it, closing issue #54.

**Architecture:** A module-level pub/sub store (`errorBus.ts`) holds a list of error entries; a new `ErrorPanel` component subscribes to it and renders as the first item in the sidebar's flex column, pushing other panels down while entries exist. Plain modules outside the component tree (`apiClient.ts`) report into the same bus directly — no React Context, no prop drilling. A second tiny emitter (`sessionEvents.ts`) lets the axios interceptor tell `App.tsx` to clear signed-in state on a 401 without giving it a reference into React state.

**Tech Stack:** React 19, TypeScript, Vite, daisyUI 4 / Tailwind (existing dependencies only — no new packages), Vitest + Testing Library for unit tests.

**Spec:** `docs/superpowers/specs/2026-09-13-error-handling-ui-design.md`

## Global Constraints

- No new npm dependencies — build on daisyUI's existing `alert`/`alert-error` classes, not a new library.
- Manual dismiss only; no auto-dismiss timers (approved design decision).
- Multiple errors stack as independent, independently-dismissible entries — never replace one another.
- `ErrorPanel` renders as the **first child** of the sidebar's flex column in `App.tsx` (`<div className="flex flex-col overflow-y-auto lg:pt-7">`), so it's in normal document flow (pushes other panels down) — not fixed/floating positioning, no extra z-index handling needed.
- Error messages: short, actionable, no error codes/stack traces exposed to the user. Use the exact wording given in each task below (it must match the spec verbatim, since tests assert on it).
- New files follow the repo's TypeScript style guide (`contributing/styleguide/typescript.md`): single quotes, explicit semicolons, named exports only. Edits to existing files preserve that file's own existing quote/semicolon convention rather than reformatting the whole file.
- Every mutating call site gets `try`/`catch`/`finally` so a failure always resets whatever loading/disabled UI state it set — no more buttons stuck on "Saving…"/"Sending…" forever.
- The apiClient response interceptor auto-reports network errors, 401, and 5xx; it does **not** auto-report other 4xx codes (left to the call site, since these are often expected — e.g. an invalid share token). Call sites also add their own specific message on top of whatever the interceptor already showed — a single network/5xx failure on a wired-up call site can therefore show two stacked entries. This is an accepted, spec'd trade-off — do not try to suppress it.

---

## File Structure

New files:
- `frontend/src/services/errorBus.ts` — the error store: `reportError`, `dismissError`, `subscribeErrors`, `ErrorEntry` type.
- `frontend/src/services/errorBus.test.ts`
- `frontend/src/services/sessionEvents.ts` — `notifySessionExpired`, `onSessionExpired`.
- `frontend/src/services/sessionEvents.test.ts`
- `frontend/src/components/ErrorPanel.tsx` — renders the stacked, dismissible alert entries.
- `frontend/src/components/ErrorPanel.test.tsx`

Modified files:
- `frontend/src/apiClient.ts` — adds the response interceptor.
- `frontend/src/apiClient.test.ts` — tests the interceptor's three branches.
- `frontend/src/App.tsx` — mounts `ErrorPanel`; wires GPX upload, weather fetch, stored-route restore, sign-out, and session-expiry subscription.
- `frontend/src/App.test.tsx` — extended with failure-path tests for each of the above.
- `frontend/src/components/SignInPanel.tsx` / `.test.tsx` — magic-link failure handling.
- `frontend/src/components/SaveRouteButton.tsx` / `.test.tsx` — save/update failure handling.
- `frontend/src/components/ShareToggle.tsx` / `.test.tsx` — adds a `busy` loading state; share/unshare/copy failure handling.
- `frontend/src/components/MyRoutesPanel.tsx` / `.test.tsx` — list/load/duplicate/delete failure handling.

---

### Task 1: `errorBus.ts` — the error store

**Files:**
- Create: `frontend/src/services/errorBus.ts`
- Test: `frontend/src/services/errorBus.test.ts`

**Interfaces:**
- Produces: `interface ErrorEntry { id: number; message: string }`, `reportError(message: string): void`, `dismissError(id: number): void`, `subscribeErrors(listener: (entries: ErrorEntry[]) => void): () => void`. Every later task that reports or displays an error imports from here.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/services/errorBus.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('errorBus', () => {
  beforeEach(() => {
    // Module holds state at module scope — force a fresh instance per test.
    vi.resetModules();
  });

  it('reportError adds an entry and notifies subscribers', async () => {
    const { reportError, subscribeErrors } = await import('./errorBus');
    const seen: { id: number; message: string }[][] = [];
    subscribeErrors(entries => seen.push(entries));

    reportError('Something failed');

    expect(seen).toHaveLength(2); // initial empty snapshot, then the update
    expect(seen[1]).toEqual([{ id: 1, message: 'Something failed' }]);
  });

  it('dismissError removes only the matching entry', async () => {
    const { reportError, dismissError, subscribeErrors } = await import('./errorBus');
    reportError('First');
    reportError('Second');
    let latest: { id: number; message: string }[] = [];
    subscribeErrors(entries => { latest = entries; });

    dismissError(1);

    expect(latest.map(e => e.message)).toEqual(['Second']);
  });

  it('a listener subscribing after an entry exists receives it immediately', async () => {
    const { reportError, subscribeErrors } = await import('./errorBus');
    reportError('Already here');

    let received: { message: string }[] = [];
    subscribeErrors(entries => { received = entries; });

    expect(received.map(e => e.message)).toEqual(['Already here']);
  });

  it('multiple reportError calls stack rather than replace', async () => {
    const { reportError, subscribeErrors } = await import('./errorBus');
    let latest: { message: string }[] = [];
    subscribeErrors(entries => { latest = entries; });

    reportError('One');
    reportError('Two');

    expect(latest.map(e => e.message)).toEqual(['One', 'Two']);
  });

  it('subscribeErrors returns an unsubscribe function that stops further updates', async () => {
    const { reportError, subscribeErrors } = await import('./errorBus');
    const seen: number[] = [];
    const unsubscribe = subscribeErrors(entries => seen.push(entries.length));
    unsubscribe();

    reportError('After unsubscribe');

    expect(seen).toEqual([0]); // only the initial snapshot, no update after unsubscribing
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/services/errorBus.test.ts`
Expected: FAIL — `Failed to resolve import "./errorBus"`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/services/errorBus.ts
export interface ErrorEntry {
  id: number;
  message: string;
}

type Listener = (entries: ErrorEntry[]) => void;

let entries: ErrorEntry[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener(entries);
}

export function reportError(message: string): void {
  entries = [...entries, { id: nextId++, message }];
  notify();
}

export function dismissError(id: number): void {
  entries = entries.filter(entry => entry.id !== id);
  notify();
}

export function subscribeErrors(listener: Listener): () => void {
  listeners.add(listener);
  listener(entries);
  return () => listeners.delete(listener);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/services/errorBus.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/services/errorBus.ts src/services/errorBus.test.ts
git commit -m "feat(frontend): add errorBus, a shared store for surfacing failures"
```

---

### Task 2: `sessionEvents.ts` — session-expiry notification

**Files:**
- Create: `frontend/src/services/sessionEvents.ts`
- Test: `frontend/src/services/sessionEvents.test.ts`

**Interfaces:**
- Produces: `notifySessionExpired(): void`, `onSessionExpired(listener: () => void): () => void`. Used by the apiClient interceptor (Task 7) to fire, and by `App.tsx` (Task 8) to subscribe.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/services/sessionEvents.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sessionEvents', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('notifySessionExpired calls all registered listeners', async () => {
    const { notifySessionExpired, onSessionExpired } = await import('./sessionEvents');
    const a = vi.fn();
    const b = vi.fn();
    onSessionExpired(a);
    onSessionExpired(b);

    notifySessionExpired();

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('a listener can unsubscribe and stops receiving notifications', async () => {
    const { notifySessionExpired, onSessionExpired } = await import('./sessionEvents');
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    unsubscribe();

    notifySessionExpired();

    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/services/sessionEvents.test.ts`
Expected: FAIL — `Failed to resolve import "./sessionEvents"`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/services/sessionEvents.ts
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifySessionExpired(): void {
  for (const listener of listeners) listener();
}

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/services/sessionEvents.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/services/sessionEvents.ts src/services/sessionEvents.test.ts
git commit -m "feat(frontend): add sessionEvents for signalling session expiry out of apiClient"
```

---

### Task 3: `ErrorPanel.tsx` — the visible panel

**Files:**
- Create: `frontend/src/components/ErrorPanel.tsx`
- Test: `frontend/src/components/ErrorPanel.test.tsx`

**Interfaces:**
- Consumes: `subscribeErrors`, `dismissError`, `ErrorEntry` from `../services/errorBus` (Task 1).
- Produces: `export function ErrorPanel(): JSX.Element | null`. Mounted by `App.tsx` in Task 4.

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/components/ErrorPanel.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorPanel } from './ErrorPanel';

const mocks = vi.hoisted(() => ({
  subscribeErrors: vi.fn(),
  dismissError: vi.fn(),
}));

vi.mock('../services/errorBus', () => ({
  subscribeErrors: mocks.subscribeErrors,
  dismissError: mocks.dismissError,
}));

describe('ErrorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders nothing with no entries', () => {
    mocks.subscribeErrors.mockImplementation(listener => {
      listener([]);
      return () => {};
    });

    const { container } = render(<ErrorPanel />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders one alert per entry', () => {
    mocks.subscribeErrors.mockImplementation(listener => {
      listener([
        { id: 1, message: 'First problem' },
        { id: 2, message: 'Second problem' },
      ]);
      return () => {};
    });

    render(<ErrorPanel />);

    expect(screen.getByText('First problem')).toBeInTheDocument();
    expect(screen.getByText('Second problem')).toBeInTheDocument();
  });

  it('clicking a dismiss button removes only that entry', () => {
    mocks.subscribeErrors.mockImplementation(listener => {
      listener([
        { id: 1, message: 'First problem' },
        { id: 2, message: 'Second problem' },
      ]);
      return () => {};
    });

    render(<ErrorPanel />);
    fireEvent.click(screen.getByLabelText('Dismiss: First problem'));

    expect(mocks.dismissError).toHaveBeenCalledWith(1);
    expect(mocks.dismissError).not.toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/ErrorPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./ErrorPanel"`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/components/ErrorPanel.tsx
import { useEffect, useState } from 'react';
import { subscribeErrors, dismissError, type ErrorEntry } from '../services/errorBus';

export function ErrorPanel(): JSX.Element | null {
  const [entries, setEntries] = useState<ErrorEntry[]>([]);

  useEffect(() => subscribeErrors(setEntries), []);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {entries.map(entry => (
        <div key={entry.id} role="alert" className="alert alert-error shadow flex items-start justify-between">
          <span className="text-sm">{entry.message}</span>
          <button
            className="btn btn-ghost btn-xs btn-circle"
            aria-label={`Dismiss: ${entry.message}`}
            onClick={() => dismissError(entry.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/ErrorPanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/ErrorPanel.tsx src/components/ErrorPanel.test.tsx
git commit -m "feat(frontend): add ErrorPanel, a dismissible stack of error entries"
```

---

### Task 4: Mount `ErrorPanel` in `App.tsx` and wire GPX upload

**Files:**
- Modify: `frontend/src/App.tsx` (imports near the top; sidebar JSX around what's currently line 511; `handleFileUpload`'s `catch` around what's currently line 197-200)
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `ErrorPanel` (Task 3), `reportError` from `../services/errorBus` (Task 1).

- [ ] **Step 1: Write the failing test**

In `frontend/src/App.test.tsx`, add the import and mock near the top, alongside the existing ones:

```ts
import { reportError } from './services/errorBus';
```

```ts
vi.mock('./services/errorBus', () => ({
  reportError: vi.fn(),
}));
```

Replace the existing `'parse error shows alert, does not set route, does not fetch weather'` test (around line 435) with:

```ts
it('parse error reports it to the error panel, does not set route, does not fetch weather', async () => {
  vi.mocked(parseGPXAsync).mockRejectedValue(new Error('No tracks found'));
  render(<App />);
  await uploadFile();

  await waitFor(() => expect(reportError).toHaveBeenCalledWith('No tracks found'));
  expect(DEFAULT_PROVIDER.fetchWeather).not.toHaveBeenCalled();
  expect(screen.queryByTestId('elevation-chart')).not.toBeInTheDocument();
  expect(screen.queryByTestId('wind-chart')).not.toBeInTheDocument();
});
```

Also remove the now-unused `vi.spyOn(window, 'alert').mockImplementation(() => {});` line from the outer `beforeEach` (around line 183) — `alert` is no longer called anywhere in `App.tsx` after this task.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/App.test.tsx -t "parse error reports it"`
Expected: FAIL — `reportError` was not called (GPX upload still calls `alert`).

- [ ] **Step 3: Implement**

In `frontend/src/App.tsx`, add two imports near the other local imports (after `import { Tooltip } from './components/Tooltip';`):

```tsx
import { ErrorPanel } from './components/ErrorPanel';
import { reportError } from './services/errorBus';
```

In `handleFileUpload`'s catch block, replace:

```tsx
    } catch (error) {
      console.error('Failed to parse GPX:', error);
      const message = error instanceof Error ? error.message : 'Failed to parse GPX file. Please ensure it is a valid track.';
      alert(message);
    } finally {
```

with:

```tsx
    } catch (error) {
      console.error('Failed to parse GPX:', error);
      const message = error instanceof Error ? error.message : 'Failed to parse GPX file. Please ensure it is a valid track.';
      reportError(message);
    } finally {
```

In the sidebar JSX, change:

```tsx
        {/* Sidebar — single-open accordion via collapse-open + activePanel state */}
        <div className="flex flex-col overflow-y-auto lg:pt-7">

          {/* Ride Details */}
```

to:

```tsx
        {/* Sidebar — single-open accordion via collapse-open + activePanel state */}
        <div className="flex flex-col overflow-y-auto lg:pt-7">
          <ErrorPanel />

          {/* Ride Details */}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: PASS (all tests, including the rewritten one).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/App.tsx src/App.test.tsx
git commit -m "feat(frontend): mount ErrorPanel and report GPX parse failures through it"
```

---

### Task 5: Wire weather-fetch failures

**Files:**
- Modify: `frontend/src/App.tsx` (`updateWeather`'s `catch` block)
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `reportError` (already imported in Task 4).

- [ ] **Step 1: Write the failing test**

Replace the existing `'weather fetch error does not crash — charts still render'` test (around line 446) with:

```ts
it('weather fetch error reports it to the error panel, and charts still render', async () => {
  vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockRejectedValue(new Error('Network error'));
  render(<App />);
  await uploadFile();

  // Auto-fetch runs on load and fails
  await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalled());

  expect(reportError).toHaveBeenCalledWith("Couldn't fetch weather for this route. Try refreshing.");
  // Charts render (route was set despite weather failure)
  expect(screen.getByTestId('elevation-chart')).toBeInTheDocument();
  // Button does not show — isDirty requires lastFetchedParams !== null
  expect(screen.queryByText('Refresh')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/App.test.tsx -t "weather fetch error reports"`
Expected: FAIL — `reportError` was not called.

- [ ] **Step 3: Implement**

In `updateWeather`'s catch block, replace:

```tsx
    } catch (error) {
      console.error('Weather fetch failed:', error);
      setWeatherPoints([]);
      return false;
    }
```

with:

```tsx
    } catch (error) {
      console.error('Weather fetch failed:', error);
      reportError("Couldn't fetch weather for this route. Try refreshing.");
      setWeatherPoints([]);
      return false;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/App.tsx src/App.test.tsx
git commit -m "feat(frontend): report weather-fetch failures to the error panel"
```

---

### Task 6: Wire stored-route restore failures

**Files:**
- Modify: `frontend/src/App.tsx` (mount effect's localStorage-restore `.catch`)
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `reportError` (already imported).

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/App.test.tsx`:

```ts
it('reports an error and clears storage when restoring a stored route fails', async () => {
  window.history.replaceState({}, '', '/');
  localStorage.setItem('trippy_current_route', JSON.stringify({
    name: 'Test Route',
    gpxContent: '<gpx/>',
    avgSpeedKmh: 20,
    startTime: '2026-06-17T08:00:00.000Z',
  }));
  vi.mocked(parseGPXAsync).mockRejectedValue(new Error('corrupt gpx'));

  render(<App />);

  await waitFor(() => {
    expect(reportError).toHaveBeenCalledWith("Couldn't restore your last route. Please re-upload it.");
  });
  expect(localStorage.getItem('trippy_current_route')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/App.test.tsx -t "reports an error and clears storage"`
Expected: FAIL — `reportError` was not called.

- [ ] **Step 3: Implement**

In the mount effect, replace:

```tsx
        loadRouteFromGpxText(stored.gpxContent, stored.avgSpeedKmh, start, epsilon, maxGap, storedCheckpoints)
          .catch(() => clearStoredRoute());
```

with:

```tsx
        loadRouteFromGpxText(stored.gpxContent, stored.avgSpeedKmh, start, epsilon, maxGap, storedCheckpoints)
          .catch(() => {
            reportError("Couldn't restore your last route. Please re-upload it.");
            clearStoredRoute();
          });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/App.tsx src/App.test.tsx
git commit -m "feat(frontend): report an error when restoring a stored route fails"
```

---

### Task 7: `apiClient.ts` response interceptor

**Files:**
- Modify: `frontend/src/apiClient.ts`
- Test: `frontend/src/apiClient.test.ts`

**Interfaces:**
- Consumes: `reportError` from `./services/errorBus` (Task 1), `notifySessionExpired` from `./services/sessionEvents` (Task 2), `clearToken` from `./auth` (existing).
- Produces: the interceptor's behavior is relied on by nothing else directly — every call site's own `try`/`catch` (Tasks 4-6, 9-12) observes the same rejected promise after this interceptor runs.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `frontend/src/apiClient.test.ts` with:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./auth', () => ({
  getToken: vi.fn(() => 'test-token'),
  clearToken: vi.fn(),
}))

const mocks = vi.hoisted(() => ({
  reportError: vi.fn(),
  notifySessionExpired: vi.fn(),
}))

vi.mock('./services/errorBus', () => ({
  reportError: mocks.reportError,
}))

vi.mock('./services/sessionEvents', () => ({
  notifySessionExpired: mocks.notifySessionExpired,
}))

// Axios doesn't expose a public way to invoke a registered response
// interceptor directly, so tests reach into interceptors.response.handlers —
// the same internal array axios itself walks when a real request fails.
async function rejectedHandler() {
  const { axiosInstance } = await import('./apiClient')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers = (axiosInstance.interceptors.response as any).handlers
  return handlers[0].rejected as (error: unknown) => Promise<never>
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports authApi, routesApi, shareApi, and versionApi', async () => {
    const { authApi, routesApi, shareApi, versionApi } = await import('./apiClient')
    expect(authApi).toBeDefined()
    expect(routesApi).toBeDefined()
    expect(shareApi).toBeDefined()
    expect(versionApi).toBeDefined()
  })

  it('attaches Bearer token to requests', async () => {
    const { axiosInstance } = await import('./apiClient')
    expect(axiosInstance.interceptors.request).toBeDefined()
  })

  it('reports a network-error message and rethrows when the request has no response', async () => {
    const rejected = await rejectedHandler()
    const error = Object.assign(new Error('timeout'), { isAxiosError: true, response: undefined })

    await expect(rejected(error)).rejects.toBe(error)
    expect(mocks.reportError).toHaveBeenCalledWith('Network error — please check your connection and try again.')
  })

  it('clears the session, notifies listeners, and reports a session-expired message on 401', async () => {
    const { clearToken } = await import('./auth')
    const rejected = await rejectedHandler()
    const error = Object.assign(new Error('unauthorized'), {
      isAxiosError: true,
      response: { status: 401 },
    })

    await expect(rejected(error)).rejects.toBe(error)
    expect(clearToken).toHaveBeenCalled()
    expect(mocks.notifySessionExpired).toHaveBeenCalled()
    expect(mocks.reportError).toHaveBeenCalledWith('Your session has expired. Please sign in again.')
  })

  it('reports a generic server-error message and rethrows on a 500', async () => {
    const rejected = await rejectedHandler()
    const error = Object.assign(new Error('server error'), {
      isAxiosError: true,
      response: { status: 500 },
    })

    await expect(rejected(error)).rejects.toBe(error)
    expect(mocks.reportError).toHaveBeenCalledWith('Something went wrong on our end. Please try again.')
  })

  it('does not auto-report a non-401 4xx error, but still rethrows it', async () => {
    const rejected = await rejectedHandler()
    const error = Object.assign(new Error('not found'), {
      isAxiosError: true,
      response: { status: 404 },
    })

    await expect(rejected(error)).rejects.toBe(error)
    expect(mocks.reportError).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/apiClient.test.ts`
Expected: FAIL — `axiosInstance.interceptors.response.handlers[0]` is undefined (no response interceptor registered yet), and `clearToken`/`reportError`/`notifySessionExpired` are not exported from `./auth` in the way the new mock expects (`clearToken` mock added) until the interceptor uses it.

- [ ] **Step 3: Implement**

Replace the full contents of `frontend/src/apiClient.ts` with:

```ts
import axios from 'axios'
import { AuthApi, RoutesApi, ShareApi, VersionApi } from './api'
import { getToken, clearToken } from './auth'
import { reportError } from './services/errorBus'
import { notifySessionExpired } from './services/sessionEvents'

export const axiosInstance = axios.create()

axiosInstance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined
    if (status === undefined) {
      reportError('Network error — please check your connection and try again.')
    } else if (status === 401) {
      clearToken()
      notifySessionExpired()
      reportError('Your session has expired. Please sign in again.')
    } else if (status >= 500) {
      reportError('Something went wrong on our end. Please try again.')
    }
    return Promise.reject(error)
  }
)

export const authApi = new AuthApi(undefined, undefined, axiosInstance)
export const routesApi = new RoutesApi(undefined, undefined, axiosInstance)
export const shareApi = new ShareApi(undefined, undefined, axiosInstance)
export const versionApi = new VersionApi(undefined, undefined, axiosInstance)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/apiClient.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/apiClient.ts src/apiClient.test.ts
git commit -m "feat(frontend): add apiClient response interceptor for network/401/5xx errors"
```

---

### Task 8: Session-expiry subscription and sign-out error handling

**Files:**
- Modify: `frontend/src/App.tsx` (mount effects; the `AuthHeader`'s `onSignOut` handler around what's currently line 460-469)
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `onSessionExpired` from `./services/sessionEvents` (Task 2), `reportError` (already imported).

- [ ] **Step 1: Write the failing tests**

In `frontend/src/App.test.tsx`, add near the other mocks:

```ts
vi.mock('./services/sessionEvents', () => ({
  onSessionExpired: vi.fn(),
}));
```

Change the existing top-level apiClient mock's `authApi` entry from:

```ts
  authApi: { getMe: vi.fn() },
```

to:

```ts
  authApi: { getMe: vi.fn(), deleteSession: vi.fn() },
```

Add two new `describe` blocks (anywhere after the existing ones, e.g. right after the `'token landing'` block):

```ts
describe('sign-out', () => {
  it('signs out locally and reports an error when the server call fails', async () => {
    const { isAuthenticated } = await import('./auth')
    const { authApi } = await import('./apiClient')
    vi.mocked(isAuthenticated).mockReturnValue(true)
    vi.mocked(authApi.getMe).mockResolvedValue({ data: { id: 1, email: 'a@b.com' } })
    vi.mocked(authApi.deleteSession).mockRejectedValue(new Error('network down'))

    render(<App />)
    await waitFor(() => screen.getByRole('button', { name: /sign out/i }))
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(reportError).toHaveBeenCalledWith("Couldn't reach the server to end your session, but you've been signed out locally.")
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })
  })
})

describe('session expiry', () => {
  it('signs the user out when a session-expired event fires', async () => {
    const { isAuthenticated } = await import('./auth')
    const { authApi } = await import('./apiClient')
    const { onSessionExpired } = await import('./services/sessionEvents')
    vi.mocked(isAuthenticated).mockReturnValue(true)
    vi.mocked(authApi.getMe).mockResolvedValue({ data: { id: 1, email: 'a@b.com' } })

    render(<App />)
    await waitFor(() => screen.getByRole('button', { name: /sign out/i }))

    act(() => {
      // Simulate the apiClient interceptor detecting a 401 on some background call.
      vi.mocked(onSessionExpired).mock.calls[0][0]()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/App.test.tsx -t "sign-out"` and `cd frontend && npx vitest run src/App.test.tsx -t "session expiry"`
Expected: both FAIL — sign-out test fails because the current handler discards the error (`reportError` never called); session-expiry test fails because `onSessionExpired` is never called by `App.tsx` yet, so `.mock.calls[0]` is undefined.

- [ ] **Step 3: Implement**

Add the import near the other local imports in `App.tsx`:

```tsx
import { onSessionExpired } from './services/sessionEvents';
```

Add a new mount effect right after the existing "Token landing — runs once on mount" effect (which ends around what's currently line 397 with `}, []);`):

```tsx
  // Lets the apiClient response interceptor (apiClient.ts) tell us the
  // session was invalidated server-side, without holding a reference into
  // React state itself.
  React.useEffect(() => onSessionExpired(() => setUser(null)), []);
```

Replace the `onSignOut` handler:

```tsx
              onSignOut={async () => {
                try {
                  await authApi.deleteSession()
                } catch {
                  // ignore - proceed to clear local session regardless
                }
                clearToken()
                setUser(null)
              }}
```

with:

```tsx
              onSignOut={async () => {
                try {
                  await authApi.deleteSession()
                } catch {
                  reportError("Couldn't reach the server to end your session, but you've been signed out locally.")
                } finally {
                  clearToken()
                  setUser(null)
                }
              }}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/App.tsx src/App.test.tsx
git commit -m "feat(frontend): react to session expiry and report failed sign-out to the error panel"
```

---

### Task 9: `SignInPanel.tsx` — magic-link failure handling

**Files:**
- Modify: `frontend/src/components/SignInPanel.tsx`
- Test: `frontend/src/components/SignInPanel.test.tsx`

**Interfaces:**
- Consumes: `reportError` from `../services/errorBus` (Task 1).

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/SignInPanel.test.tsx`, near the top:

```ts
vi.mock('../services/errorBus', () => ({
  reportError: vi.fn(),
}));
```

And a new test:

```ts
it('shows an error and resets to idle when the magic link request fails', async () => {
  const { reportError } = await import('../services/errorBus');
  mocks.requestMagicLink.mockRejectedValue(new Error('network down'));

  render(<SignInPanel open={true} onClose={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText(/your email/i), {
    target: { value: 'rider@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: /send link/i }));

  await waitFor(() => {
    expect(reportError).toHaveBeenCalledWith("Couldn't send the sign-in link. Please try again.");
    // Back to idle, not stuck on "Sending…"
    expect(screen.getByRole('button', { name: /send link/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/SignInPanel.test.tsx -t "shows an error and resets to idle"`
Expected: FAIL — the button stays stuck on "Sending…" and `reportError` is never called (unhandled rejection).

- [ ] **Step 3: Implement**

In `frontend/src/components/SignInPanel.tsx`, add the import:

```tsx
import { reportError } from '../services/errorBus';
```

Replace `handleSendLink`:

```tsx
  async function handleSendLink(e: SubmitEvent) {
    e.preventDefault();
    setState('sending');
    await authApi.requestMagicLink({ email });
    setState('sent');
  }
```

with:

```tsx
  async function handleSendLink(e: SubmitEvent) {
    e.preventDefault();
    setState('sending');
    try {
      await authApi.requestMagicLink({ email });
      setState('sent');
    } catch {
      reportError("Couldn't send the sign-in link. Please try again.");
      setState('idle');
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/SignInPanel.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/SignInPanel.tsx src/components/SignInPanel.test.tsx
git commit -m "feat(frontend): report failed magic-link requests and stop the button getting stuck"
```

---

### Task 10: `SaveRouteButton.tsx` — save/update failure handling

**Files:**
- Modify: `frontend/src/components/SaveRouteButton.tsx`
- Test: `frontend/src/components/SaveRouteButton.test.tsx`

**Interfaces:**
- Consumes: `reportError` from `../services/errorBus` (Task 1).

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/SaveRouteButton.test.tsx`, near the top:

```ts
vi.mock('../services/errorBus', () => ({
  reportError: vi.fn(),
}));
```

And a new test:

```ts
it('shows an error and resets to idle when saving fails', async () => {
  const { reportError } = await import('../services/errorBus');
  mocks.createRoute.mockRejectedValue(new Error('network down'));

  render(
    <SaveRouteButton
      isAuthenticated={true}
      name="My Ride"
      onNameChange={vi.fn()}
      routeData={routeData}
      savedRouteId={null}
      onSaved={vi.fn()}
      onRequireAuth={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /save route/i }));

  await waitFor(() => {
    expect(reportError).toHaveBeenCalledWith("Couldn't save the route. Please try again.");
    // Back to idle, not stuck on "Saving…"
    expect(screen.getByRole('button', { name: /save route/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/SaveRouteButton.test.tsx -t "shows an error and resets to idle"`
Expected: FAIL — the button stays stuck on "Saving…" and `reportError` is never called (unhandled rejection).

- [ ] **Step 3: Implement**

In `frontend/src/components/SaveRouteButton.tsx`, add the import:

```tsx
import { reportError } from '../services/errorBus';
```

Replace `handleSave`:

```tsx
  async function handleSave(saveAsNew: boolean) {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setState('saving');
    if (savedRouteId && !saveAsNew) {
      const res = await routesApi.updateRoute(savedRouteId, {
        name,
        avgSpeedKmh: routeData.avgSpeedKmh,
        startTime: routeData.startTime,
        checkpointsJson: routeData.checkpointsJson,
      });
      onSaved(res.data.id as string);
    } else {
      const res = await routesApi.createRoute({ name, ...routeData });
      onSaved(res.data.id as string);
    }
    setState('idle');
  }
```

with:

```tsx
  async function handleSave(saveAsNew: boolean) {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setState('saving');
    try {
      if (savedRouteId && !saveAsNew) {
        const res = await routesApi.updateRoute(savedRouteId, {
          name,
          avgSpeedKmh: routeData.avgSpeedKmh,
          startTime: routeData.startTime,
          checkpointsJson: routeData.checkpointsJson,
        });
        onSaved(res.data.id as string);
      } else {
        const res = await routesApi.createRoute({ name, ...routeData });
        onSaved(res.data.id as string);
      }
    } catch {
      reportError("Couldn't save the route. Please try again.");
    } finally {
      setState('idle');
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/SaveRouteButton.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/SaveRouteButton.tsx src/components/SaveRouteButton.test.tsx
git commit -m "feat(frontend): report failed route saves and stop the button getting stuck"
```

---

### Task 11: `ShareToggle.tsx` — busy state plus share/unshare/copy failure handling

**Files:**
- Modify: `frontend/src/components/ShareToggle.tsx`
- Test: `frontend/src/components/ShareToggle.test.tsx`

**Interfaces:**
- Consumes: `reportError` from `../services/errorBus` (Task 1).

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/components/ShareToggle.test.tsx`, near the top:

```ts
vi.mock('../services/errorBus', () => ({
  reportError: vi.fn(),
}))
```

And three new tests:

```ts
it('shows an error and re-enables the button when sharing fails', async () => {
  const { reportError } = await import('../services/errorBus')
  mocks.shareRoute.mockRejectedValue(new Error('network down'))

  render(<ShareToggle routeId="uuid-1" isPublic={false} shareToken={null} baseUrl="https://trippy.app" />)
  fireEvent.click(screen.getByRole('button', { name: /share/i }))

  await waitFor(() => {
    expect(reportError).toHaveBeenCalledWith("Couldn't create a share link. Please try again.")
    expect(screen.getByRole('button', { name: /share/i })).not.toBeDisabled()
  })
})

it('shows an error and re-enables the button when unsharing fails', async () => {
  const { reportError } = await import('../services/errorBus')
  mocks.unshareRoute.mockRejectedValue(new Error('network down'))

  render(<ShareToggle routeId="uuid-1" isPublic={true} shareToken="tok123" baseUrl="https://trippy.app" />)
  fireEvent.click(screen.getByRole('button', { name: /stop sharing/i }))

  await waitFor(() => {
    expect(reportError).toHaveBeenCalledWith("Couldn't stop sharing. Please try again.")
    expect(screen.getByRole('button', { name: /stop sharing/i })).not.toBeDisabled()
  })
})

it('shows an error when copying the link fails', async () => {
  const { reportError } = await import('../services/errorBus')
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
  })

  render(<ShareToggle routeId="uuid-1" isPublic={true} shareToken="tok123" baseUrl="https://trippy.app" />)
  fireEvent.click(screen.getByRole('button', { name: /copy/i }))

  await waitFor(() => {
    expect(reportError).toHaveBeenCalledWith("Couldn't copy the link — please copy it manually.")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/ShareToggle.test.tsx`
Expected: the 3 new tests FAIL — `reportError` is never called (unhandled rejections today), and there's no `disabled` attribute to assert on.

- [ ] **Step 3: Implement**

Replace the full contents of `frontend/src/components/ShareToggle.tsx` with:

```tsx
import { useState } from 'react'
import { routesApi } from '../apiClient'
import { reportError } from '../services/errorBus'

interface Props {
  routeId: string
  isPublic: boolean
  shareToken: string | null
  baseUrl: string
}

export function ShareToggle({ routeId, isPublic, shareToken, baseUrl }: Props) {
  const [currentToken, setCurrentToken] = useState(shareToken)
  const [isShared, setIsShared] = useState(isPublic)
  const [busy, setBusy] = useState(false)
  const shareUrl = currentToken ? `${baseUrl}/share/${currentToken}` : null

  async function handleShare() {
    setBusy(true)
    try {
      const res = await routesApi.shareRoute(routeId)
      setCurrentToken(res.data.shareToken as string)
      setIsShared(true)
    } catch {
      reportError("Couldn't create a share link. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleUnshare() {
    setBusy(true)
    try {
      await routesApi.unshareRoute(routeId)
      setCurrentToken(null)
      setIsShared(false)
    } catch {
      reportError("Couldn't stop sharing. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      reportError("Couldn't copy the link — please copy it manually.")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {shareUrl && (
        <div className="flex items-center gap-2">
          <span className="text-xs truncate flex-1">{shareUrl}</span>
          <button className="btn btn-ghost btn-xs" onClick={handleCopy}>
            Copy
          </button>
        </div>
      )}
      {isShared ? (
        <button className="btn btn-outline btn-sm w-full" onClick={handleUnshare} disabled={busy}>
          Stop sharing
        </button>
      ) : (
        <button className="btn btn-outline btn-sm w-full" onClick={handleShare} disabled={busy}>
          Share
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/ShareToggle.test.tsx`
Expected: PASS (all tests, including the pre-existing ones — the `disabled` attribute doesn't affect a click already in flight when `fireEvent.click` runs synchronously before the state update).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/ShareToggle.tsx src/components/ShareToggle.test.tsx
git commit -m "feat(frontend): add a busy state to ShareToggle and report share/unshare/copy failures"
```

---

### Task 12: `MyRoutesPanel.tsx` — list/load/duplicate/delete failure handling

**Files:**
- Modify: `frontend/src/components/MyRoutesPanel.tsx`
- Test: `frontend/src/components/MyRoutesPanel.test.tsx`

**Interfaces:**
- Consumes: `reportError` from `../services/errorBus` (Task 1).

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/components/MyRoutesPanel.test.tsx`, near the top:

```ts
vi.mock('../services/errorBus', () => ({
  reportError: vi.fn(),
}))
```

And four new tests:

```ts
it('shows an error when the initial route list fails to load', async () => {
  const { reportError } = await import('../services/errorBus')
  mocks.listRoutes.mockRejectedValue(new Error('network down'))

  render(<MyRoutesPanel onLoadRoute={vi.fn()} onDeleted={vi.fn()} />)

  await waitFor(() => {
    expect(reportError).toHaveBeenCalledWith("Couldn't load your saved routes. Please try again.")
  })
})

it('shows an error when loading a route fails', async () => {
  const { reportError } = await import('../services/errorBus')
  mocks.listRoutes.mockResolvedValue({ data: sampleItems })
  mocks.getRoute.mockRejectedValue(new Error('network down'))

  const onLoadRoute = vi.fn()
  render(<MyRoutesPanel onLoadRoute={onLoadRoute} onDeleted={vi.fn()} />)

  await waitFor(() => screen.getByText('Alpine Loop'))
  fireEvent.click(screen.getByText('Alpine Loop'))

  await waitFor(() => {
    expect(reportError).toHaveBeenCalledWith("Couldn't load that route. Please try again.")
  })
  expect(onLoadRoute).not.toHaveBeenCalled()
})

it('shows an error when duplicating a route fails', async () => {
  const { reportError } = await import('../services/errorBus')
  mocks.listRoutes.mockResolvedValue({ data: sampleItems })
  mocks.getRoute.mockRejectedValue(new Error('network down'))

  render(<MyRoutesPanel onLoadRoute={vi.fn()} onDeleted={vi.fn()} />)

  await waitFor(() => screen.getByText('Alpine Loop'))
  fireEvent.click(screen.getByRole('button', { name: /duplicate alpine loop/i }))

  await waitFor(() => {
    expect(reportError).toHaveBeenCalledWith("Couldn't duplicate the route. Please try again.")
  })
  expect(mocks.createRoute).not.toHaveBeenCalled()
})

it('shows an error and keeps the confirm dialog open when deleting fails', async () => {
  const { reportError } = await import('../services/errorBus')
  mocks.listRoutes.mockResolvedValue({ data: sampleItems })
  mocks.deleteRoute.mockRejectedValue(new Error('network down'))

  render(<MyRoutesPanel onLoadRoute={vi.fn()} onDeleted={vi.fn()} />)

  await waitFor(() => screen.getByText('Alpine Loop'))
  fireEvent.click(screen.getByRole('button', { name: /delete alpine loop/i }))
  fireEvent.click(screen.getByRole('button', { name: /^ok$/i }))

  await waitFor(() => {
    expect(reportError).toHaveBeenCalledWith("Couldn't delete the route. Please try again.")
  })
  // Dialog stays open so the user can retry or cancel, instead of silently closing.
  expect(screen.getByText(`Delete 'Alpine Loop' on the ${expectedDate}?`)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/MyRoutesPanel.test.tsx`
Expected: the 4 new tests FAIL — none of these calls has a `catch` today, so `reportError` is never invoked and the delete dialog closes unconditionally.

- [ ] **Step 3: Implement**

In `frontend/src/components/MyRoutesPanel.tsx`, add the import:

```tsx
import { reportError } from '../services/errorBus'
```

Replace `fetchRoutes` and the mount `useEffect`:

```tsx
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
```

with:

```tsx
  const fetchRoutes = useCallback(async () => {
    try {
      const res = await routesApi.listRoutes()
      setRoutes(res.data)
    } catch {
      reportError("Couldn't load your saved routes. Please try again.")
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    routesApi.listRoutes()
      .then(res => { if (!cancelled) setRoutes(res.data) })
      .catch(() => { if (!cancelled) reportError("Couldn't load your saved routes. Please try again.") })
      .finally(() => { if (!cancelled) setFetchedFor(refreshKey) })
    return () => { cancelled = true }
  }, [refreshKey])
```

Replace `handleClick`:

```tsx
  async function handleClick(id: string, avgSpeedKmh: number, startTime: string, name: string) {
    const res = await routesApi.getRoute(id)
    onLoadRoute(res.data.gpxContent as string, avgSpeedKmh, startTime, id, name, res.data.checkpointsJson as string | undefined)
  }
```

with:

```tsx
  async function handleClick(id: string, avgSpeedKmh: number, startTime: string, name: string) {
    try {
      const res = await routesApi.getRoute(id)
      onLoadRoute(res.data.gpxContent as string, avgSpeedKmh, startTime, id, name, res.data.checkpointsJson as string | undefined)
    } catch {
      reportError("Couldn't load that route. Please try again.")
    }
  }
```

Replace `handleDuplicate`:

```tsx
  async function handleDuplicate(e: React.MouseEvent, id: string, name: string, avgSpeedKmh: number, startTime: string) {
    e.stopPropagation()
    const res = await routesApi.getRoute(id)
    await routesApi.createRoute({
      name: `${name} (copy)`,
      gpxContent: res.data.gpxContent as string,
      avgSpeedKmh,
      startTime,
      checkpointsJson: res.data.checkpointsJson as string | undefined,
    })
    await fetchRoutes()
  }
```

with:

```tsx
  async function handleDuplicate(e: React.MouseEvent, id: string, name: string, avgSpeedKmh: number, startTime: string) {
    e.stopPropagation()
    try {
      const res = await routesApi.getRoute(id)
      await routesApi.createRoute({
        name: `${name} (copy)`,
        gpxContent: res.data.gpxContent as string,
        avgSpeedKmh,
        startTime,
        checkpointsJson: res.data.checkpointsJson as string | undefined,
      })
      await fetchRoutes()
    } catch {
      reportError("Couldn't duplicate the route. Please try again.")
    }
  }
```

Replace `handleConfirmDelete`:

```tsx
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
```

with:

```tsx
  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await routesApi.deleteRoute(pendingDelete.id)
      await fetchRoutes()
      const id = pendingDelete.id
      setPendingDelete(null)
      onDeleted(id)
    } catch {
      reportError("Couldn't delete the route. Please try again.")
    } finally {
      setDeleting(false)
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/MyRoutesPanel.test.tsx`
Expected: PASS (all tests, including the pre-existing ones — the success paths are unchanged).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/MyRoutesPanel.tsx src/components/MyRoutesPanel.test.tsx
git commit -m "feat(frontend): report list/load/duplicate/delete failures in MyRoutesPanel"
```

---

### Task 13: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, zero failures.

- [ ] **Step 2: Type-check and build**

Run: `cd frontend && npm run build`
Expected: succeeds — no TypeScript errors (in particular, verify `ErrorPanel`'s `JSX.Element | null` return type and the interceptor's `unknown`-typed error parameter both compile cleanly).

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors. If the `eslint-disable-next-line @typescript-eslint/no-explicit-any` in `apiClient.test.ts` (Task 7) is flagged as unnecessary or the rule name doesn't match this repo's ESLint config, fix the disable comment to match rather than suppressing a different rule.

- [ ] **Step 4: Manual smoke test**

Run: `cd frontend && npm run dev`, open `http://localhost:5173`, and verify by hand:
- Upload an invalid file as a `.gpx` (e.g. rename a `.txt` file) → a red alert appears at the top of the sidebar, above "Ride Details", with a working ✕ dismiss button.
- Trigger two failures in a row (e.g. invalid GPX, then open Tech Details and switch to a provider that errors) → two stacked entries appear, dismissible independently.
- No `alert()` popup appears anywhere in this flow.

This step is manual verification only — no code changes, no commit.

---

## Out of scope (carried over from the spec — do not implement here)

- Distinguishing "failed to load" from "genuinely empty" in `MyRoutesPanel`'s list state.
- Retry affordances on the error entries themselves.
- Capping the number of stacked error entries.
- Suppressing the interceptor's generic message when a call site's own specific message will also fire.
