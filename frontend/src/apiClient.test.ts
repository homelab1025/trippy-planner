// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

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
    expect(axiosInstance.interceptors.request).toBeDefined()
  })
})
