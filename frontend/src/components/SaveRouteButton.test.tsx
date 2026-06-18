// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SaveRouteButton } from './SaveRouteButton'

const mocks = vi.hoisted(() => ({
  createRoute: vi.fn(),
  requestMagicLink: vi.fn(),
}))

vi.mock('../apiClient', () => ({
  routesApi: { createRoute: mocks.createRoute },
  authApi: { requestMagicLink: mocks.requestMagicLink },
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
    cleanup()
  })

  it('calls createRoute immediately when authenticated', async () => {
    mocks.createRoute.mockResolvedValue({ data: { id: 'abc', ...routeData } })

    render(<SaveRouteButton isAuthenticated={true} routeData={routeData} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save route/i }))

    await waitFor(() => {
      expect(mocks.createRoute).toHaveBeenCalledWith(routeData)
    })
  })

  it('shows email input when not authenticated', () => {
    render(<SaveRouteButton isAuthenticated={false} routeData={routeData} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save route/i }))
    expect(screen.getByPlaceholderText(/your email/i)).toBeInTheDocument()
  })

  it('sends magic link when email submitted', async () => {
    mocks.requestMagicLink.mockResolvedValue({})

    render(<SaveRouteButton isAuthenticated={false} routeData={routeData} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save route/i }))
    fireEvent.change(screen.getByPlaceholderText(/your email/i), {
      target: { value: 'rider@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send link/i }))

    await waitFor(() => {
      expect(mocks.requestMagicLink).toHaveBeenCalledWith({ email: 'rider@example.com' })
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    })
  })
})
