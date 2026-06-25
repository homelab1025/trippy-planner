// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'

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
