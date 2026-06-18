# Frontend Auth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auth session management, "My routes" panel, save route flow, share toggle, and public route view to the existing frontend — all additive, no existing functionality changes.

**Architecture:** A thin `auth.ts` module manages the session token in `localStorage`. The generated Axios client (from `openapi.yaml`) is configured once with a request interceptor that attaches `Authorization: Bearer <token>`. On app mount, if `?token=` is in the URL, it is stored and stripped. New UI components are added to the existing sidebar; `App.tsx` gains `user` and `savedRoutes` state alongside its existing state.

**Tech Stack:** TypeScript, React 19, Axios (already installed), Vitest + Testing Library, Playwright, `@openapitools/openapi-generator-cli`

**Prerequisite:** Monorepo restructure plan complete (openapi.yaml exists). Backend API plan complete (backend running at `http://backend:8080`).

---

### Task 1: Add OpenAPI generator and generate the TypeScript client

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/.openapi-generator-ignore` (optional, to suppress unwanted files)
- Gitignore: `frontend/src/api/`

- [ ] **Step 1: Install the OpenAPI generator CLI**

```bash
cd frontend && npm install --save-dev @openapitools/openapi-generator-cli
```

- [ ] **Step 2: Add generate script to `frontend/package.json`**

Add to the `"scripts"` block:

```json
"generate:api": "openapi-generator-cli generate -i ../openapi.yaml -g typescript-axios -o src/api --additional-properties=supportsES6=true,withSeparateModelsAndApi=false,modelPropertyNaming=camelCase,enumPropertyNaming=camelCase"
```

- [ ] **Step 3: Add generated files to `.gitignore`**

Add to `frontend/.gitignore` (or create it):

```
src/api/
```

- [ ] **Step 4: Run the generator**

```bash
cd frontend && npm run generate:api
```

Expected: `frontend/src/api/` is created with `api.ts` containing `AuthApi`, `RoutesApi`, `ShareApi` classes, and model types (`User`, `Route`, `RouteListItem`, `CreateRouteRequest`, etc.).

- [ ] **Step 5: Verify TypeScript compiles with the generated client**

```bash
cd frontend && npm run build
```

Expected: `BUILD SUCCESS` — no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/.gitignore
git commit -m "feat: add OpenAPI generator CLI and generate TypeScript Axios client"
```

---

### Task 2: Session token module (`auth.ts`)

**Files:**
- Create: `frontend/src/auth.ts`
- Create: `frontend/src/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/auth.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const STORAGE_KEY = 'trippy_session_token'

// Use localStorage mock provided by jsdom
describe('auth', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no token stored', async () => {
    const { getToken } = await import('./auth')
    expect(getToken()).toBeNull()
  })

  it('stores and retrieves a token', async () => {
    const { setToken, getToken } = await import('./auth')
    setToken('abc123')
    expect(getToken()).toBe('abc123')
  })

  it('clears the token', async () => {
    const { setToken, clearToken, getToken } = await import('./auth')
    setToken('abc123')
    clearToken()
    expect(getToken()).toBeNull()
  })

  it('returns true for isAuthenticated when token present', async () => {
    const { setToken, isAuthenticated } = await import('./auth')
    setToken('abc123')
    expect(isAuthenticated()).toBe(true)
  })

  it('returns false for isAuthenticated when no token', async () => {
    const { isAuthenticated } = await import('./auth')
    expect(isAuthenticated()).toBe(false)
  })
})
```

Note: Vitest uses jsdom by default when `environment: 'jsdom'` is set. The existing vite.config.ts uses `environment: 'node'` globally, so add a file-level override comment at the top of `auth.test.ts`:

```typescript
// @vitest-environment jsdom
```

Place it as the very first line.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/auth.test.ts
```

Expected: FAIL — `./auth` not found.

- [ ] **Step 3: Write `frontend/src/auth.ts`**

```typescript
const STORAGE_KEY = 'trippy_session_token'

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function isAuthenticated(): boolean {
  return getToken() !== null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/auth.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/auth.ts frontend/src/auth.test.ts
git commit -m "feat: add auth.ts session token module"
```

---

### Task 3: Configured Axios API client

**Files:**
- Create: `frontend/src/apiClient.ts`
- Create: `frontend/src/apiClient.test.ts`

The generated `src/api/api.ts` exports `AuthApi`, `RoutesApi`, and `ShareApi` classes that each accept an Axios instance. This module creates one shared Axios instance with the Bearer interceptor and exports pre-configured API client instances.

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment jsdom
// frontend/src/apiClient.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'

vi.mock('./auth', () => ({
  getToken: vi.fn(() => 'test-token'),
}))

describe('apiClient', () => {
  it('exports authApi, routesApi, and shareApi', async () => {
    const { authApi, routesApi, shareApi } = await import('./apiClient')
    expect(authApi).toBeDefined()
    expect(routesApi).toBeDefined()
    expect(shareApi).toBeDefined()
  })

  it('attaches Bearer token to requests', async () => {
    const { axiosInstance } = await import('./apiClient')
    // Inspect that interceptors are registered
    expect(axiosInstance.interceptors.request).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/apiClient.test.ts
```

Expected: FAIL — `./apiClient` not found.

- [ ] **Step 3: Write `frontend/src/apiClient.ts`**

```typescript
import axios from 'axios'
import { AuthApi, RoutesApi, ShareApi } from './api'
import { getToken } from './auth'

export const axiosInstance = axios.create()

axiosInstance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authApi = new AuthApi(undefined, '', axiosInstance)
export const routesApi = new RoutesApi(undefined, '', axiosInstance)
export const shareApi = new ShareApi(undefined, '', axiosInstance)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/apiClient.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/apiClient.ts frontend/src/apiClient.test.ts
git commit -m "feat: add configured Axios client with Bearer token interceptor"
```

---

### Task 4: Token landing on app mount

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

When the app loads, check `window.location.search` for `?token=`. If found: store it, strip it from the URL with `history.replaceState`, then call `GET /api/auth/me` to confirm validity and retrieve the user's email. Add `user: { id: number; email: string } | null` to App state.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/App.test.tsx`:

```typescript
import { setToken, clearToken, getToken } from './auth'

describe('token landing', () => {
  beforeEach(() => {
    clearToken()
    // Reset URL
    window.history.replaceState({}, '', '/')
  })

  it('stores token from URL and strips it', async () => {
    window.history.replaceState({}, '', '/?token=mytesttoken')
    // Mock authApi.getMe
    vi.mock('./apiClient', () => ({
      authApi: { getMe: vi.fn().mockResolvedValue({ data: { id: 1, email: 'a@b.com' } }) },
      routesApi: {},
      shareApi: {},
    }))

    render(<App />)
    await waitFor(() => {
      expect(getToken()).toBe('mytesttoken')
      expect(window.location.search).toBe('')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/App.test.tsx
```

Expected: FAIL — token landing not implemented.

- [ ] **Step 3: Add user state and token landing to `App.tsx`**

At the top of the `App` component (before existing state declarations), add:

```typescript
import { getToken, setToken, clearToken, isAuthenticated } from './auth'
import { authApi } from './apiClient'

// Inside App():
const [user, setUser] = useState<{ id: number; email: string } | null>(null)

// Token landing — runs once on mount
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (token) {
    setToken(token)
    params.delete('token')
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '')
    history.replaceState(null, '', newUrl)
  }

  if (isAuthenticated()) {
    authApi.getMe()
      .then(res => setUser(res.data))
      .catch(() => {
        clearToken()
        setUser(null)
      })
  }
}, [])
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/App.test.tsx
```

Expected: all App tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: store and validate session token on app mount"
```

---

### Task 5: Header auth UI

**Files:**
- Create: `frontend/src/components/AuthHeader.tsx`
- Create: `frontend/src/components/AuthHeader.test.tsx`

Shows the user's email and a sign-out button when authenticated, or nothing when anonymous. The parent (`App.tsx`) passes `user` and `onSignOut`.

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment jsdom
// frontend/src/components/AuthHeader.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AuthHeader } from './AuthHeader'

describe('AuthHeader', () => {
  it('shows nothing when user is null', () => {
    const { container } = render(<AuthHeader user={null} onSignOut={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows user email when authenticated', () => {
    render(<AuthHeader user={{ id: 1, email: 'rider@example.com' }} onSignOut={vi.fn()} />)
    expect(screen.getByText('rider@example.com')).toBeInTheDocument()
  })

  it('calls onSignOut when sign-out is clicked', () => {
    const onSignOut = vi.fn()
    render(<AuthHeader user={{ id: 1, email: 'a@b.com' }} onSignOut={onSignOut} />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/AuthHeader.test.tsx
```

Expected: FAIL — `AuthHeader` not found.

- [ ] **Step 3: Write `AuthHeader.tsx`**

```typescript
// frontend/src/components/AuthHeader.tsx

interface Props {
  user: { id: number; email: string } | null
  onSignOut: () => void
}

export function AuthHeader({ user, onSignOut }: Props) {
  if (!user) return null
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-base-content/70">{user.email}</span>
      <button className="btn btn-ghost btn-xs" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Wire into `App.tsx`**

Add the `AuthHeader` to the existing header area in `App.tsx`:

```typescript
import { AuthHeader } from './components/AuthHeader'

// Inside JSX, in the header area:
<AuthHeader
  user={user}
  onSignOut={() => {
    authApi.deleteSession().catch(() => {})
    clearToken()
    setUser(null)
  }}
/>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/components/AuthHeader.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AuthHeader.tsx frontend/src/components/AuthHeader.test.tsx \
        frontend/src/App.tsx
git commit -m "feat: add AuthHeader component with sign-out"
```

---

### Task 6: Save route flow

**Files:**
- Create: `frontend/src/components/SaveRouteButton.tsx`
- Create: `frontend/src/components/SaveRouteButton.test.tsx`
- Modify: `frontend/src/App.tsx`

If authenticated: clicking "Save" immediately calls `POST /api/routes`. If not authenticated: shows an email input first, calls `POST /api/auth/magic-link`, then shows "Check your email."

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment jsdom
// frontend/src/components/SaveRouteButton.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SaveRouteButton } from './SaveRouteButton'

const mockRoutesApi = { createRoute: vi.fn() }
const mockAuthApi = { requestMagicLink: vi.fn() }

vi.mock('../apiClient', () => ({
  routesApi: mockRoutesApi,
  authApi: mockAuthApi,
}))

const routeData = {
  name: 'My Ride',
  gpxContent: '<gpx/>',
  avgSpeedKmh: 20,
  startTime: new Date().toISOString(),
}

describe('SaveRouteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls createRoute immediately when authenticated', async () => {
    mockRoutesApi.createRoute.mockResolvedValue({ data: { id: 'abc', ...routeData } })

    render(<SaveRouteButton isAuthenticated={true} routeData={routeData} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save route/i }))

    await waitFor(() => {
      expect(mockRoutesApi.createRoute).toHaveBeenCalledWith(routeData)
    })
  })

  it('shows email input when not authenticated', () => {
    render(<SaveRouteButton isAuthenticated={false} routeData={routeData} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save route/i }))
    expect(screen.getByPlaceholderText(/your email/i)).toBeInTheDocument()
  })

  it('sends magic link when email submitted', async () => {
    mockAuthApi.requestMagicLink.mockResolvedValue({})

    render(<SaveRouteButton isAuthenticated={false} routeData={routeData} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save route/i }))
    fireEvent.change(screen.getByPlaceholderText(/your email/i), {
      target: { value: 'rider@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send link/i }))

    await waitFor(() => {
      expect(mockAuthApi.requestMagicLink).toHaveBeenCalledWith({ email: 'rider@example.com' })
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/SaveRouteButton.test.tsx
```

Expected: FAIL — `SaveRouteButton` not found.

- [ ] **Step 3: Write `SaveRouteButton.tsx`**

```typescript
// frontend/src/components/SaveRouteButton.tsx
import { useState } from 'react'
import { authApi, routesApi } from '../apiClient'
import { CreateRouteRequest } from '../api'

interface Props {
  isAuthenticated: boolean
  routeData: CreateRouteRequest
  onSaved: (routeId: string) => void
}

type State = 'idle' | 'email-prompt' | 'sending' | 'sent' | 'saving'

export function SaveRouteButton({ isAuthenticated, routeData, onSaved }: Props) {
  const [state, setState] = useState<State>('idle')
  const [email, setEmail] = useState('')

  async function handleSave() {
    if (isAuthenticated) {
      setState('saving')
      const res = await routesApi.createRoute(routeData)
      onSaved(res.data.id as string)
      setState('idle')
    } else {
      setState('email-prompt')
    }
  }

  async function handleSendLink() {
    setState('sending')
    await authApi.requestMagicLink({ email })
    setState('sent')
  }

  if (state === 'sent') {
    return <p className="text-sm text-success">Check your email for a sign-in link.</p>
  }

  if (state === 'email-prompt' || state === 'sending') {
    return (
      <div className="flex flex-col gap-2">
        <input
          type="email"
          className="input input-bordered input-sm"
          placeholder="Your email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSendLink}
          disabled={state === 'sending'}
        >
          {state === 'sending' ? 'Sending…' : 'Send link'}
        </button>
      </div>
    )
  }

  return (
    <button
      className="btn btn-primary btn-sm"
      onClick={handleSave}
      disabled={state === 'saving'}
    >
      {state === 'saving' ? 'Saving…' : 'Save route'}
    </button>
  )
}
```

- [ ] **Step 4: Wire into `App.tsx`**

Add `SaveRouteButton` to the sidebar, conditionally rendered when a route is loaded:

```typescript
import { SaveRouteButton } from './components/SaveRouteButton'

// Inside JSX, in the sidebar, after the route stats:
{route && (
  <SaveRouteButton
    isAuthenticated={isAuthenticated()}
    routeData={{
      name: route.name ?? 'My Route',
      gpxContent: rawGpxContent,  // store raw GPX XML in App state when parsing
      avgSpeedKmh: avgSpeed,
      startTime: startTime,
    }}
    onSaved={(id) => console.log('Saved route', id)}
  />
)}
```

Note: `App.tsx` must also store `rawGpxContent: string | null` in state, populated when the GPX file is parsed. The worker returns `RouteData`; the raw string is available from the `FileReader` result before parsing. Store it alongside `route`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/components/SaveRouteButton.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SaveRouteButton.tsx \
        frontend/src/components/SaveRouteButton.test.tsx \
        frontend/src/App.tsx
git commit -m "feat: add SaveRouteButton with magic link flow for unauthenticated users"
```

---

### Task 7: My routes panel

**Files:**
- Create: `frontend/src/components/MyRoutesPanel.tsx`
- Create: `frontend/src/components/MyRoutesPanel.test.tsx`
- Modify: `frontend/src/App.tsx`

Shows a collapsible list of saved routes when authenticated. Clicking a route loads it.

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment jsdom
// frontend/src/components/MyRoutesPanel.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MyRoutesPanel } from './MyRoutesPanel'

const mockRoutesApi = {
  listRoutes: vi.fn(),
  getRoute: vi.fn(),
}

vi.mock('../apiClient', () => ({ routesApi: mockRoutesApi }))

const sampleItems = [
  { id: 'uuid-1', name: 'Alpine Loop', avgSpeedKmh: 18, isPublic: false,
    startTime: '2026-06-17T08:00:00Z', createdAt: '2026-06-17T08:00:00Z' },
]

describe('MyRoutesPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches and lists routes on mount', async () => {
    mockRoutesApi.listRoutes.mockResolvedValue({ data: sampleItems })

    render(<MyRoutesPanel onLoadRoute={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Alpine Loop')).toBeInTheDocument()
    })
  })

  it('calls onLoadRoute with GPX when route is clicked', async () => {
    mockRoutesApi.listRoutes.mockResolvedValue({ data: sampleItems })
    mockRoutesApi.getRoute.mockResolvedValue({ data: { ...sampleItems[0], gpxContent: '<gpx/>' } })

    const onLoadRoute = vi.fn()
    render(<MyRoutesPanel onLoadRoute={onLoadRoute} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByText('Alpine Loop'))

    await waitFor(() => {
      expect(onLoadRoute).toHaveBeenCalledWith('<gpx/>', 18, '2026-06-17T08:00:00Z')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/MyRoutesPanel.test.tsx
```

Expected: FAIL — `MyRoutesPanel` not found.

- [ ] **Step 3: Write `MyRoutesPanel.tsx`**

```typescript
// frontend/src/components/MyRoutesPanel.tsx
import { useEffect, useState } from 'react'
import { routesApi } from '../apiClient'
import { RouteListItem } from '../api'

interface Props {
  onLoadRoute: (gpxContent: string, avgSpeedKmh: number, startTime: string) => void
}

export function MyRoutesPanel({ onLoadRoute }: Props) {
  const [routes, setRoutes] = useState<RouteListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    routesApi.listRoutes()
      .then(res => setRoutes(res.data))
      .finally(() => setLoading(false))
  }, [])

  async function handleClick(id: string, avgSpeedKmh: number, startTime: string) {
    const res = await routesApi.getRoute(id)
    onLoadRoute(res.data.gpxContent as string, avgSpeedKmh, startTime)
  }

  if (loading) return <p className="text-sm text-base-content/50">Loading routes…</p>
  if (routes.length === 0) return <p className="text-sm text-base-content/50">No saved routes yet.</p>

  return (
    <ul className="menu menu-sm w-full">
      {routes.map(r => (
        <li key={r.id as string}>
          <button
            className="text-left"
            onClick={() => handleClick(r.id as string, r.avgSpeedKmh as number, r.startTime as string)}
          >
            <span>{r.name}</span>
            <span className="text-xs text-base-content/50 ml-auto">{r.avgSpeedKmh} km/h</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Wire into `App.tsx`**

Add `MyRoutesPanel` to the sidebar, rendered only when the user is authenticated:

```typescript
import { MyRoutesPanel } from './components/MyRoutesPanel'

// Inside JSX sidebar, after the AuthHeader:
{user && (
  <div className="collapse collapse-arrow">
    <input type="checkbox" />
    <div className="collapse-title text-sm font-medium">My routes</div>
    <div className="collapse-content">
      <MyRoutesPanel
        onLoadRoute={(gpxContent, avgSpeedKmh, startTime) => {
          // Parse the GPX and load it the same way file upload does
          handleGpxContent(gpxContent)
          setAvgSpeed(avgSpeedKmh)
          setStartTime(new Date(startTime))
        }}
      />
    </div>
  </div>
)}
```

`handleGpxContent` is an extracted helper from the existing GPX file upload handler — extract it if it isn't already.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/components/MyRoutesPanel.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/MyRoutesPanel.tsx \
        frontend/src/components/MyRoutesPanel.test.tsx \
        frontend/src/App.tsx
git commit -m "feat: add MyRoutesPanel to load saved routes from the sidebar"
```

---

### Task 8: Share toggle

**Files:**
- Create: `frontend/src/components/ShareToggle.tsx`
- Create: `frontend/src/components/ShareToggle.test.tsx`
- Modify: `frontend/src/App.tsx`

Visible only on a loaded route the user owns. Toggle calls the share/unshare API and shows a copyable link.

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment jsdom
// frontend/src/components/ShareToggle.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShareToggle } from './ShareToggle'

const mockRoutesApi = {
  shareRoute: vi.fn(),
  unshareRoute: vi.fn(),
}

vi.mock('../apiClient', () => ({ routesApi: mockRoutesApi }))

describe('ShareToggle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows enable button when route is private', () => {
    render(<ShareToggle routeId="uuid-1" isPublic={false} shareToken={null} baseUrl="https://trippy.app" />)
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
  })

  it('calls shareRoute and shows link on enable', async () => {
    mockRoutesApi.shareRoute.mockResolvedValue({ data: { shareToken: 'tok123' } })

    render(<ShareToggle routeId="uuid-1" isPublic={false} shareToken={null} baseUrl="https://trippy.app" />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))

    await waitFor(() => {
      expect(screen.getByText('https://trippy.app/share/tok123')).toBeInTheDocument()
    })
  })

  it('shows link and stop sharing button when already public', () => {
    render(<ShareToggle routeId="uuid-1" isPublic={true} shareToken="tok123" baseUrl="https://trippy.app" />)
    expect(screen.getByText('https://trippy.app/share/tok123')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stop sharing/i })).toBeInTheDocument()
  })

  it('calls unshareRoute on stop sharing', async () => {
    mockRoutesApi.unshareRoute.mockResolvedValue({})

    render(<ShareToggle routeId="uuid-1" isPublic={true} shareToken="tok123" baseUrl="https://trippy.app" />)
    fireEvent.click(screen.getByRole('button', { name: /stop sharing/i }))

    await waitFor(() => {
      expect(mockRoutesApi.unshareRoute).toHaveBeenCalledWith('uuid-1')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/ShareToggle.test.tsx
```

Expected: FAIL — `ShareToggle` not found.

- [ ] **Step 3: Write `ShareToggle.tsx`**

```typescript
// frontend/src/components/ShareToggle.tsx
import { useState } from 'react'
import { routesApi } from '../apiClient'

interface Props {
  routeId: string
  isPublic: boolean
  shareToken: string | null
  baseUrl: string
}

export function ShareToggle({ routeId, isPublic, shareToken, baseUrl }: Props) {
  const [currentToken, setCurrentToken] = useState(shareToken)
  const [isShared, setIsShared] = useState(isPublic)

  async function handleShare() {
    const res = await routesApi.shareRoute(routeId)
    setCurrentToken(res.data.shareToken as string)
    setIsShared(true)
  }

  async function handleUnshare() {
    await routesApi.unshareRoute(routeId)
    setCurrentToken(null)
    setIsShared(false)
  }

  const shareUrl = currentToken ? `${baseUrl}/share/${currentToken}` : null

  return (
    <div className="flex flex-col gap-2">
      {shareUrl && (
        <div className="flex items-center gap-2">
          <span className="text-xs truncate flex-1">{shareUrl}</span>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
          >
            Copy
          </button>
        </div>
      )}
      {isShared ? (
        <button className="btn btn-outline btn-xs" onClick={handleUnshare}>
          Stop sharing
        </button>
      ) : (
        <button className="btn btn-outline btn-xs" onClick={handleShare}>
          Share
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire into `App.tsx`**

Add `ShareToggle` to the sidebar, rendered when a user owns the currently loaded route:

```typescript
import { ShareToggle } from './components/ShareToggle'

// Add state for the current route's server-side ID and share info:
const [savedRouteId, setSavedRouteId] = useState<string | null>(null)
const [routeIsPublic, setRouteIsPublic] = useState(false)
const [routeShareToken, setRouteShareToken] = useState<string | null>(null)

// In JSX, in the sidebar, near the SaveRouteButton:
{user && savedRouteId && (
  <ShareToggle
    routeId={savedRouteId}
    isPublic={routeIsPublic}
    shareToken={routeShareToken}
    baseUrl={window.location.origin}
  />
)}
```

Update `SaveRouteButton.onSaved` to store the route ID:

```typescript
onSaved={(id) => setSavedRouteId(id)}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/components/ShareToggle.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ShareToggle.tsx \
        frontend/src/components/ShareToggle.test.tsx \
        frontend/src/App.tsx
git commit -m "feat: add ShareToggle for public route sharing"
```

---

### Task 9: Public route view (`/share/:token`)

**Files:**
- Modify: `frontend/src/App.tsx`

On app mount, if the URL path starts with `/share/`, extract the token, call `GET /api/share/{token}`, and load the route. Show a "Viewing a shared route" badge; hide save and share controls.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/App.test.tsx`:

```typescript
describe('public route view', () => {
  it('loads a shared route from /share/:token URL', async () => {
    window.history.replaceState({}, '', '/share/publictoken123')

    vi.mock('./apiClient', () => ({
      authApi: { getMe: vi.fn().mockRejectedValue(new Error()) },
      routesApi: {},
      shareApi: {
        getSharedRoute: vi.fn().mockResolvedValue({
          data: {
            id: 'uuid-1',
            name: 'Shared Alpine Loop',
            gpxContent: '<gpx><trk><trkseg></trkseg></trk></gpx>',
            avgSpeedKmh: 20,
            startTime: '2026-06-17T08:00:00Z',
            isPublic: true,
          },
        }),
      },
    }))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/viewing a shared route/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/App.test.tsx -t "public route view"
```

Expected: FAIL — shared route loading not implemented.

- [ ] **Step 3: Add public route loading to `App.tsx`**

In the mount `useEffect` (after the token landing block), add:

```typescript
import { shareApi } from './apiClient'

// Inside the useEffect, after token landing:
const pathParts = window.location.pathname.split('/')
if (pathParts[1] === 'share' && pathParts[2]) {
  const shareToken = pathParts[2]
  shareApi.getSharedRoute(shareToken)
    .then(res => {
      const data = res.data
      setIsViewingShared(true)
      handleGpxContent(data.gpxContent as string)
      setAvgSpeed(data.avgSpeedKmh as number)
      setStartTime(new Date(data.startTime as string))
    })
    .catch(() => {
      // Token invalid or route made private — show nothing, let user upload
    })
}
```

Add `isViewingShared` state:

```typescript
const [isViewingShared, setIsViewingShared] = useState(false)
```

Add "Viewing a shared route" badge in JSX (near the route stats, visible when `isViewingShared`):

```typescript
{isViewingShared && (
  <div className="badge badge-info badge-sm">Viewing a shared route</div>
)}
```

Hide `SaveRouteButton` and `ShareToggle` when `isViewingShared`:

```typescript
{route && !isViewingShared && (
  <SaveRouteButton ... />
)}
{user && savedRouteId && !isViewingShared && (
  <ShareToggle ... />
)}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/App.test.tsx
```

Expected: all App tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: load and display shared routes from /share/:token URL"
```

---

### Task 10: End-to-end smoke test with Playwright

- [ ] **Step 1: Start the full stack**

```bash
make dev
```

Wait for both services to be healthy.

- [ ] **Step 2: Test anonymous GPX upload still works**

Open `http://localhost:5173`. Upload a GPX file. Verify weather loads, map shows, chart renders — no regressions.

- [ ] **Step 3: Test save flow for unauthenticated user**

1. Load a GPX file.
2. Click "Save route."
3. Verify email input appears.
4. Enter an email and click "Send link."
5. Verify "Check your email" message appears.

- [ ] **Step 4: Test magic link landing**

1. Manually query the database for the session token just created:
   ```bash
   docker compose exec postgres psql -U trippy -d trippy -c "SELECT token FROM sessions ORDER BY created_at DESC LIMIT 1;"
   ```
2. Open `http://localhost:5173/auth?token=<token>`.
3. Verify the app loads, the token is stripped from the URL, and the user email appears in the header.

- [ ] **Step 5: Test My Routes panel**

1. While authenticated, click "My routes" in the sidebar.
2. Verify saved routes appear.
3. Click a route — verify it loads on the map.

- [ ] **Step 6: Test share flow**

1. Load a route while authenticated.
2. Click "Share" — verify a share URL appears.
3. Open the share URL in an incognito window — verify the route loads with "Viewing a shared route" badge.
4. Click "Stop sharing" — verify the old URL now returns a 404.

- [ ] **Step 7: Commit if any fixes were needed during smoke testing**

```bash
git add -p
git commit -m "fix: smoke test corrections for auth and sharing flows"
```
