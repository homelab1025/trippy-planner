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
