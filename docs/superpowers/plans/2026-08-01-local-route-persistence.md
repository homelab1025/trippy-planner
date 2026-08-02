# Local Route Persistence & Decoupled Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix #44 — a route uploaded before login must survive the full-page reload triggered by clicking a magic-link email, and logging in must be reachable independently of the Save action.

**Architecture:** Add a `routeStorage.ts` module that mirrors the working route (raw GPX text + params) to `localStorage`, rehydrated on `App.tsx` mount through the existing `loadRouteFromGpxText` path. Extract the email/magic-link UI out of `SaveRouteButton` into a standalone `SignInPanel` modal, reachable both from the navbar (`AuthHeader`) and from `SaveRouteButton` when clicked while unauthenticated.

**Tech Stack:** React 18 + TypeScript (Vite), Vitest + Testing Library for unit tests, Playwright for E2E, daisyUI/Tailwind for styling.

## Global Constraints

- TypeScript style: per `contributing/styleguide/typescript.md` — single quotes, `const`/`let` only, named exports only, `===`/`!==`, avoid `any`, explicit semicolons on every statement (no reliance on ASI). All new/rewritten files in this plan use semicolons, including the `.tsx` components — even though the current `SaveRouteButton.tsx`/`AuthHeader.tsx` predate this and don't; that pre-existing inconsistency elsewhere in the codebase is out of scope here.
- Do not commit without being told to — this plan's commit steps are commands to have ready, not to run unprompted. (Per project `CLAUDE.md`.)
- Generated code (`frontend/src/api/`) is gitignored and never hand-edited; only import types from it (`import type { CreateRouteRequest } from '../api'`).
- Playwright screenshots (if any are taken while verifying) go to `frontend/playwright-screenshots/` only.

---

### Task 1: Local route storage module

**Files:**
- Create: `frontend/src/services/routeStorage.ts`
- Test: `frontend/src/services/routeStorage.test.ts`

**Interfaces:**
- Produces: `interface StoredRoute { name: string; gpxContent: string; avgSpeedKmh: number; startTime: string }`, `loadStoredRoute(): StoredRoute | null`, `saveStoredRoute(route: StoredRoute): void`, `clearStoredRoute(): void`. These are consumed by Task 5 (`App.tsx` integration).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/services/routeStorage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadStoredRoute, saveStoredRoute, clearStoredRoute } from './routeStorage';

const sampleRoute = {
  name: 'My Ride',
  gpxContent: '<gpx/>',
  avgSpeedKmh: 22,
  startTime: '2026-08-01T10:00:00.000Z',
};

describe('routeStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(loadStoredRoute()).toBeNull();
  });

  it('round-trips a saved route', () => {
    saveStoredRoute(sampleRoute);
    expect(loadStoredRoute()).toEqual(sampleRoute);
  });

  it('returns null and clears the key when the stored value is corrupted JSON', () => {
    localStorage.setItem('trippy_current_route', 'not-json{');
    expect(loadStoredRoute()).toBeNull();
    expect(localStorage.getItem('trippy_current_route')).toBeNull();
  });

  it('clearStoredRoute removes the stored route', () => {
    saveStoredRoute(sampleRoute);
    clearStoredRoute();
    expect(loadStoredRoute()).toBeNull();
  });

  it('saveStoredRoute does not throw when localStorage.setItem throws', () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    expect(() => saveStoredRoute(sampleRoute)).not.toThrow();
    localStorage.setItem = original;
  });
});
```

Note: `frontend/src/vitest.setup.ts` already polyfills `localStorage` globally for every test, so no `@vitest-environment jsdom` directive is needed in this file (it runs fine under the default `node` environment configured in `frontend/vite.config.ts`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/services/routeStorage.test.ts`
Expected: FAIL — `Cannot find module './routeStorage'`

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/services/routeStorage.ts`:

```ts
const STORAGE_KEY = 'trippy_current_route';

export interface StoredRoute {
  name: string;
  gpxContent: string;
  avgSpeedKmh: number;
  startTime: string;
}

export function loadStoredRoute(): StoredRoute | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredRoute;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveStoredRoute(route: StoredRoute): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(route));
  } catch (error) {
    console.warn('Failed to persist route to localStorage:', error);
  }
}

export function clearStoredRoute(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/services/routeStorage.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/routeStorage.ts frontend/src/services/routeStorage.test.ts
git commit -m "feat: add localStorage-backed route persistence module"
```

---

### Task 2: SignInPanel component (extracted email/magic-link UI)

**Files:**
- Create: `frontend/src/components/SignInPanel.tsx`
- Test: `frontend/src/components/SignInPanel.test.tsx`

**Interfaces:**
- Consumes: `authApi.requestMagicLink({ email: string }): Promise<unknown>` from `frontend/src/apiClient.ts` (already exists, used identically today in `SaveRouteButton.tsx:30`).
- Produces: `SignInPanel({ open: boolean; onClose: () => void })`. Consumed by Task 4 (`App.tsx` wiring).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/SignInPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignInPanel } from './SignInPanel';

const mocks = vi.hoisted(() => ({
  requestMagicLink: vi.fn(),
}));

vi.mock('../apiClient', () => ({
  authApi: { requestMagicLink: mocks.requestMagicLink },
}));

describe('SignInPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders nothing when closed', () => {
    render(<SignInPanel open={false} onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/your email/i)).not.toBeInTheDocument();
  });

  it('shows the email form when open', () => {
    render(<SignInPanel open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/your email/i)).toBeInTheDocument();
  });

  it('sends magic link when email submitted', async () => {
    mocks.requestMagicLink.mockResolvedValue({});

    render(<SignInPanel open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/your email/i), {
      target: { value: 'rider@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send link/i }));

    await waitFor(() => {
      expect(mocks.requestMagicLink).toHaveBeenCalledWith({ email: 'rider@example.com' });
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<SignInPanel open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/SignInPanel.test.tsx`
Expected: FAIL — `Cannot find module './SignInPanel'`

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/components/SignInPanel.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { authApi } from '../apiClient';

interface Props {
  open: boolean;
  onClose: () => void;
}

type State = 'idle' | 'sending' | 'sent';

export function SignInPanel({ open, onClose }: Props) {
  const [state, setState] = useState<State>('idle');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (open) {
      setState('idle');
      setEmail('');
    }
  }, [open]);

  if (!open) return null;

  async function handleSendLink() {
    setState('sending');
    await authApi.requestMagicLink({ email });
    setState('sent');
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box relative">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
        <h3 className="font-bold text-lg mb-3">Sign in</h3>
        {state === 'sent' ? (
          <p className="text-sm text-success">Check your email for a sign-in link.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="email"
              className="input input-bordered input-sm w-full"
              placeholder="Your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm w-full"
              onClick={handleSendLink}
              disabled={state === 'sending'}
            >
              {state === 'sending' ? 'Sending…' : 'Send link'}
            </button>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/SignInPanel.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SignInPanel.tsx frontend/src/components/SignInPanel.test.tsx
git commit -m "feat: add standalone SignInPanel modal for magic-link login"
```

---

### Task 3: Simplify SaveRouteButton to delegate auth via onRequireAuth

**Files:**
- Modify: `frontend/src/components/SaveRouteButton.tsx` (full rewrite — file is 68 lines)
- Modify: `frontend/src/components/SaveRouteButton.test.tsx` (full rewrite — file is 61 lines)

**Interfaces:**
- Produces: `SaveRouteButton({ isAuthenticated: boolean; routeData: CreateRouteRequest; onSaved: (routeId: string) => void; onRequireAuth: () => void })` — the `onRequireAuth` prop is new; `isAuthenticated`, `routeData`, `onSaved` are unchanged. Consumed by Task 4 (`App.tsx` wiring, which supplies `onRequireAuth={() => setSignInOpen(true)}`).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `frontend/src/components/SaveRouteButton.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveRouteButton } from './SaveRouteButton';

const mocks = vi.hoisted(() => ({
  createRoute: vi.fn(),
}));

vi.mock('../apiClient', () => ({
  routesApi: { createRoute: mocks.createRoute },
}));

const routeData = {
  name: 'My Ride',
  gpxContent: '<gpx/>',
  avgSpeedKmh: 20,
  startTime: new Date().toISOString(),
};

describe('SaveRouteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('calls createRoute immediately when authenticated', async () => {
    mocks.createRoute.mockResolvedValue({ data: { id: 'abc', ...routeData } });
    const onSaved = vi.fn();

    render(
      <SaveRouteButton
        isAuthenticated={true}
        routeData={routeData}
        onSaved={onSaved}
        onRequireAuth={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save route/i }));

    await waitFor(() => {
      expect(mocks.createRoute).toHaveBeenCalledWith(routeData);
      expect(onSaved).toHaveBeenCalledWith('abc');
    });
  });

  it('calls onRequireAuth instead of createRoute when not authenticated', () => {
    const onRequireAuth = vi.fn();

    render(
      <SaveRouteButton
        isAuthenticated={false}
        routeData={routeData}
        onSaved={vi.fn()}
        onRequireAuth={onRequireAuth}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save route/i }));

    expect(onRequireAuth).toHaveBeenCalled();
    expect(mocks.createRoute).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/SaveRouteButton.test.tsx`
Expected: FAIL — `onRequireAuth` is not a valid prop / TS error, and `expect(onRequireAuth).toHaveBeenCalled()` fails against the current implementation which shows an inline email form instead.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `frontend/src/components/SaveRouteButton.tsx`:

```tsx
import { useState } from 'react';
import { routesApi } from '../apiClient';
import type { CreateRouteRequest } from '../api';

interface Props {
  isAuthenticated: boolean;
  routeData: CreateRouteRequest;
  onSaved: (routeId: string) => void;
  onRequireAuth: () => void;
}

type State = 'idle' | 'saving';

export function SaveRouteButton({ isAuthenticated, routeData, onSaved, onRequireAuth }: Props) {
  const [state, setState] = useState<State>('idle');

  async function handleSave() {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setState('saving');
    const res = await routesApi.createRoute(routeData);
    onSaved(res.data.id as string);
    setState('idle');
  }

  return (
    <button
      className="btn btn-primary btn-sm w-full"
      onClick={handleSave}
      disabled={state === 'saving'}
    >
      {state === 'saving' ? 'Saving…' : 'Save route'}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/SaveRouteButton.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SaveRouteButton.tsx frontend/src/components/SaveRouteButton.test.tsx
git commit -m "refactor: extract SaveRouteButton's login UI into onRequireAuth callback"
```

---

### Task 4: Wire SignInPanel into AuthHeader and App.tsx

**Files:**
- Modify: `frontend/src/components/AuthHeader.tsx` (full rewrite — file is 16 lines)
- Modify: `frontend/src/App.tsx:1-24` (imports), `frontend/src/App.tsx:63-66` (state), `frontend/src/App.tsx:293-296` (root render), `frontend/src/App.tsx:303-313` (AuthHeader usage), `frontend/src/App.tsx:441-453` (SaveRouteButton usage)
- Modify: `frontend/src/components/AuthHeader.test.tsx` (full rewrite — file already exists, 24 lines; its current `'shows nothing when user is null'` test asserts the old behavior and must be replaced, not appended to — it will fail once the logged-out state renders a "Sign in" button)

**Interfaces:**
- Consumes: `SignInPanel` from Task 2, `SaveRouteButton`'s new `onRequireAuth` prop from Task 3.
- Produces: `AuthHeader({ user: {id, email} | null; onSignOut: () => void; onSignIn: () => void })` — `onSignIn` is new.

- [ ] **Step 1: Replace the failing test**

`frontend/src/components/AuthHeader.test.tsx` already exists with two tests: `'shows nothing when user is null'` and `'shows user email when authenticated'` / `'calls onSignOut...'`. The first of those asserts the *old* logged-out behavior (`toBeEmptyDOMElement()`) and will contradict the new "Sign in" button — it must be replaced, not kept alongside the new test. Replace the full contents of the file:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthHeader } from './AuthHeader';

describe('AuthHeader', () => {
  beforeEach(() => {
    cleanup();
  });

  it('shows a Sign in button when logged out', () => {
    const onSignIn = vi.fn();
    render(<AuthHeader user={null} onSignOut={vi.fn()} onSignIn={onSignIn} />);

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('shows the user email and Sign out button when logged in', () => {
    render(
      <AuthHeader
        user={{ id: 1, email: 'rider@example.com' }}
        onSignOut={vi.fn()}
        onSignIn={vi.fn()}
      />
    );

    expect(screen.getByText('rider@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('calls onSignOut when sign-out is clicked', () => {
    const onSignOut = vi.fn();
    render(<AuthHeader user={{ id: 1, email: 'a@b.com' }} onSignOut={onSignOut} onSignIn={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
```

Note: the third test (`calls onSignOut...`) is carried over unchanged from the existing file — only the `onSignIn` prop was added to satisfy the updated `Props` type. It's included here in full since this is a full-file replacement, not a diff.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/AuthHeader.test.tsx`
Expected: FAIL — logged-out `AuthHeader` currently renders `null` (`AuthHeader.tsx:7`), so no "Sign in" button exists yet, and `onSignIn` isn't a valid prop.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `frontend/src/components/AuthHeader.tsx`:

```tsx
interface Props {
  user: { id: number; email: string } | null;
  onSignOut: () => void;
  onSignIn: () => void;
}

export function AuthHeader({ user, onSignOut, onSignIn }: Props) {
  if (!user) {
    return (
      <button className="btn btn-ghost btn-xs" onClick={onSignIn}>
        Sign in
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-base-content/70">{user.email}</span>
      <button className="btn btn-ghost btn-xs" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
```

Now wire it into `App.tsx`. First, add the import (`frontend/src/App.tsx:14`, right after the `SaveRouteButton` import):

```tsx
import { SaveRouteButton } from './components/SaveRouteButton';
import { SignInPanel } from './components/SignInPanel';
```

Add `signInOpen` state (`frontend/src/App.tsx:66`, right after `isViewingShared`):

```tsx
  const [isViewingShared, setIsViewingShared] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
```

Render `SignInPanel` as the first child of the root wrapper (`frontend/src/App.tsx:293-296`):

```tsx
  return (
    <div className="flex flex-col h-screen overflow-y-auto max-w-[1400px] mx-auto p-3 sm:p-6 gap-4 sm:gap-6">
      <SignInPanel open={signInOpen} onClose={() => setSignInOpen(false)} />

      {/* Navbar with logo overlapping its bottom-left edge on lg+; inline on mobile */}
```

Pass `onSignIn` to `AuthHeader` (`frontend/src/App.tsx:305-312`):

```tsx
            <AuthHeader
              user={user}
              onSignOut={() => {
                authApi.deleteSession().catch(() => {})
                clearToken()
                setUser(null)
              }}
              onSignIn={() => setSignInOpen(true)}
            />
```

Pass `onRequireAuth` to `SaveRouteButton` (`frontend/src/App.tsx:441-453`):

```tsx
                {route && rawGpxContent && !isViewingShared && (
                  <div className="flex-1">
                    <SaveRouteButton
                      isAuthenticated={isAuthenticated()}
                      routeData={{
                        name: route.name ?? 'My Route',
                        gpxContent: rawGpxContent,
                        avgSpeedKmh: avgSpeed,
                        startTime: startTime.toISOString(),
                      }}
                      onSaved={(id) => setSavedRouteId(id)}
                      onRequireAuth={() => setSignInOpen(true)}
                    />
                  </div>
                )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/AuthHeader.test.tsx`
Expected: PASS (2 tests)

Run: `cd frontend && npm run build`
Expected: type-check passes — confirms `App.tsx`'s new props satisfy `SaveRouteButton` and `AuthHeader`'s updated interfaces.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AuthHeader.tsx frontend/src/components/AuthHeader.test.tsx frontend/src/App.tsx
git commit -m "feat: add persistent Sign in control, decoupled from Save"
```

---

### Task 5: Rehydrate and persist the working route via routeStorage in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx:7` (import), `frontend/src/App.tsx:232-270` (mount effect), add new effect after it

**Interfaces:**
- Consumes: `loadStoredRoute`, `saveStoredRoute` from Task 1 (`frontend/src/services/routeStorage.ts`); `loadRouteFromGpxText` (existing, `App.tsx:204-215`, signature `(gpxContent: string, speed: number, start: Date) => Promise<void>`).

This task has no isolated unit test of its own — `App.tsx`'s mount effect and the underlying `parseGPXAsync` web worker call are not covered by the existing Vitest suite (there's no `App.test.tsx`), and the codebase's own testing convention for this exact flow is Playwright E2E. Task 7 provides that E2E coverage. Verification here is manual dev-server testing plus the full test/build suite staying green.

- [ ] **Step 1: Add the import**

`frontend/src/App.tsx:9` (after the `RoutePoint` type import, alongside other utils imports — insert near the top import block, e.g. right after `import { detectClimbs } from './utils/climbDetector';`):

```tsx
import { detectClimbs } from './utils/climbDetector';
import { loadStoredRoute, saveStoredRoute } from './services/routeStorage';
```

- [ ] **Step 2: Rehydrate from local storage in the mount effect**

Current code at `frontend/src/App.tsx:232-270`:

```tsx
  // Token landing — runs once on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      params.delete('token');
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      history.replaceState(null, '', newUrl);
    }

    if (isAuthenticated()) {
      authApi.getMe()
        .then(res => setUser(res.data))
        .catch(() => {
          clearToken();
          setUser(null);
        });
    }

    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'share' && pathParts[2]) {
      const shareToken = pathParts[2];
      shareApi.getSharedRoute(shareToken)
        .then(res => {
          const data = res.data;
          const speed = data.avgSpeedKmh as number;
          const start = new Date(data.startTime as string);
          setIsViewingShared(true);
          setAvgSpeed(speed);
          setStartTime(start);
          loadRouteFromGpxText(data.gpxContent as string, speed, start);
        })
        .catch(() => {
          // Token invalid or route made private — let user upload
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount
  }, []);
```

Replace it with:

```tsx
  // Token landing — runs once on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      params.delete('token');
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      history.replaceState(null, '', newUrl);
    }

    if (isAuthenticated()) {
      authApi.getMe()
        .then(res => setUser(res.data))
        .catch(() => {
          clearToken();
          setUser(null);
        });
    }

    const pathParts = window.location.pathname.split('/');
    const isSharePath = pathParts[1] === 'share' && !!pathParts[2];

    if (isSharePath) {
      const shareToken = pathParts[2];
      shareApi.getSharedRoute(shareToken)
        .then(res => {
          const data = res.data;
          const speed = data.avgSpeedKmh as number;
          const start = new Date(data.startTime as string);
          setIsViewingShared(true);
          setAvgSpeed(speed);
          setStartTime(start);
          loadRouteFromGpxText(data.gpxContent as string, speed, start);
        })
        .catch(() => {
          // Token invalid or route made private — let user upload
        });
    } else {
      const stored = loadStoredRoute();
      if (stored) {
        const start = new Date(stored.startTime);
        setAvgSpeed(stored.avgSpeedKmh);
        setStartTime(start);
        loadRouteFromGpxText(stored.gpxContent, stored.avgSpeedKmh, start);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount
  }, []);
```

This is the fix's core: a magic-link reload no longer needs `?token=` to carry anything but the token itself, because whatever route the user had loaded is picked back up from `localStorage` in this same mount pass — regardless of whether the reload happened to also contain a `token` query param.

- [ ] **Step 3: Persist the working route whenever it changes**

Add a new effect directly after the mount effect (i.e. after the closing `}, []);` shown above, before the `onHoverIndex` callback at the former `App.tsx:272`):

```tsx
  // Mirror the working route to localStorage so it survives a full-page reload
  // (e.g. the one triggered by clicking a magic-link email — see #44).
  React.useEffect(() => {
    if (isViewingShared) return;
    if (!route || !rawGpxContent) return;
    saveStoredRoute({
      name: route.name ?? 'My Route',
      gpxContent: rawGpxContent,
      avgSpeedKmh: avgSpeed,
      startTime: startTime.toISOString(),
    });
  }, [route, rawGpxContent, avgSpeed, startTime, isViewingShared]);
```

- [ ] **Step 4: Verify manually with the dev server**

Run: `cd frontend && npm run dev`

1. Open `http://localhost:5173`, upload `public/sample-route.gpx`.
2. Reload the page (`Cmd+R`). Confirm the route is still shown (header stats, map, chart) instead of the empty "Upload a GPX file" state.
3. Open devtools → Application → Local Storage → confirm a `trippy_current_route` key holding the route JSON.

Expected: route persists across reload.

- [ ] **Step 5: Run the full frontend test suite and type-check**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all existing unit tests still pass; build/type-check succeeds. (Playwright E2E tests are handled in Tasks 6–7, run separately since they need the dev server and backend running.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "fix: persist and rehydrate the working route via localStorage (#44)"
```

---

### Task 6: Update the existing Playwright test that assumed reload clears route state

**Files:**
- Modify: `frontend/tests/my-routes.spec.ts:108-113`

**Interfaces:**
- None — this task only adjusts test setup to account for Task 5's new behavior; it does not change any production code.

The test `'clicking a saved route loads it onto the map and chart'` in `frontend/tests/my-routes.spec.ts` currently reloads the page and asserts nothing is loaded, specifically to isolate "does clicking a saved route in the My Routes panel actually load it." After Task 5, a plain reload no longer clears the route — it restores it from `localStorage`. The test must explicitly clear the new storage key to still start from a blank slate.

- [ ] **Step 1: Update the test**

Current code at `frontend/tests/my-routes.spec.ts:108-113`:

```ts
    // Reload to clear in-memory route state — nothing should be loaded now
    await page.reload();
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toHaveCount(0);
    await expect(page.getByText('Upload a GPX file to see your route')).toBeVisible();
```

Replace it with:

```ts
    // Clear the locally-persisted route, then reload — nothing should be loaded now.
    // (Without this, the reload would restore the just-saved route from
    // localStorage instead of leaving a blank slate — see #44.)
    await page.evaluate(() => localStorage.removeItem('trippy_current_route'));
    await page.reload();
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toHaveCount(0);
    await expect(page.getByText('Upload a GPX file to see your route')).toBeVisible();
```

- [ ] **Step 2: Run the My Routes E2E suite**

Run: `cd frontend && npx playwright test tests/my-routes.spec.ts`
Expected: all 5 tests in this file PASS (requires the dev server and backend — `make dev` or equivalent running first; Playwright's `webServer` config starts the frontend automatically per `frontend/playwright.config.ts`, but the backend/database must already be up).

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/my-routes.spec.ts
git commit -m "test: clear persisted route before reload in My Routes E2E test"
```

---

### Task 7: New E2E test reproducing #44 end-to-end

**Files:**
- Create: `frontend/tests/local-route-persistence.spec.ts`

**Interfaces:**
- Consumes: `createAuthenticatedSession(email?: string): Promise<string>` from `frontend/tests/helpers/testAuth.ts` (existing, unchanged).

- [ ] **Step 1: Write the test**

Create `frontend/tests/local-route-persistence.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createAuthenticatedSession } from './helpers/testAuth';

const TEST_EMAIL = 'e2e-local-persistence@trippy-planner.test';

test.describe('Local route persistence across magic-link login (#44)', () => {
  test('route uploaded before login survives the magic-link reload and can then be saved', async ({ page }) => {
    await page.goto('/');

    // Upload a GPX file while anonymous
    await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');

    // Clicking Save route while unauthenticated opens the sign-in panel, not an inline email form
    await page.getByRole('button', { name: 'Save route' }).click();
    await expect(page.getByPlaceholderText(/your email/i)).toBeVisible();
    await page.getByPlaceholderText(/your email/i).fill(TEST_EMAIL);
    await page.getByRole('button', { name: /send link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible();

    // Simulate clicking the magic link: obtain the real token issued for this
    // email via the e2e test backdoor (backend e2e profile), the same way
    // my-routes.spec.ts establishes sessions.
    const token = await createAuthenticatedSession(TEST_EMAIL);

    // Clean up any routes left over from a previous run of this test.
    await page.evaluate(async (authToken) => {
      const res = await fetch('/api/routes', { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        const routes: { id: string }[] = await res.json();
        for (const r of routes) {
          await fetch(`/api/routes/${r.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
        }
      }
    }, token);

    // Navigate as the emailed magic link would — a full page load with ?token=
    await page.goto(`/?token=${token}`);
    await page.waitForTimeout(1000);

    // The route survives the full-page reload triggered by the magic link
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');

    // And the account is now authenticated
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();

    // Saving now succeeds — this is the behavior #44 reported as broken
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);
    await page.getByText('My routes').click();
    await page.waitForTimeout(500);
    const myRoutesPanel = page.locator('text=My routes').locator('..').locator('..');
    await expect(myRoutesPanel.locator('li')).toHaveCount(1);
    await expect(myRoutesPanel.locator('li').first()).toContainText('Sample Ride');
  });
});
```

- [ ] **Step 2: Run the new test**

Run: `cd frontend && npx playwright test tests/local-route-persistence.spec.ts`
Expected: PASS (1 test). Requires the dev server (auto-started by Playwright's `webServer` config) and the backend running with the `e2e` Spring profile (whose `InMemoryEmailService` captures magic-link tokens instead of emailing them — same setup already required by `tests/my-routes.spec.ts`).

- [ ] **Step 3: Run the full Playwright suite to confirm no regressions**

Run: `cd frontend && npx playwright test`
Expected: all tests PASS, including `my-routes.spec.ts` (Task 6) and the new `local-route-persistence.spec.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/tests/local-route-persistence.spec.ts
git commit -m "test: add E2E coverage reproducing #44 (route survives magic-link login)"
```

---

## Post-implementation

- Close #44 by referencing the commits/PR (do not close manually before the fix is merged and verified).
- Remind the user that #46 (use `updateRoute` for re-saves) and #47 (invalidate superseded magic-link tokens) were filed as follow-ups during design and are intentionally not addressed by this plan.
