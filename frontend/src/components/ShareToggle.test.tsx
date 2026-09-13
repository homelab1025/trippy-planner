// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShareToggle } from './ShareToggle'

const mocks = vi.hoisted(() => ({
  shareRoute: vi.fn(),
  unshareRoute: vi.fn(),
}))

vi.mock('../apiClient', () => ({
  routesApi: mocks,
}))

vi.mock('../services/errorBus', () => ({
  reportError: vi.fn(),
}))

describe('ShareToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('shows enable button when route is private', () => {
    render(<ShareToggle routeId="uuid-1" isPublic={false} shareToken={null} baseUrl="https://trippy.app" />)
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
  })

  it('calls shareRoute and shows link on enable', async () => {
    mocks.shareRoute.mockResolvedValue({ data: { shareToken: 'tok123' } })

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
    mocks.unshareRoute.mockResolvedValue({})

    render(<ShareToggle routeId="uuid-1" isPublic={true} shareToken="tok123" baseUrl="https://trippy.app" />)
    fireEvent.click(screen.getByRole('button', { name: /stop sharing/i }))

    await waitFor(() => {
      expect(mocks.unshareRoute).toHaveBeenCalledWith('uuid-1')
    })
  })

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
    const originalClipboard = navigator.clipboard
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })

    try {
      render(<ShareToggle routeId="uuid-1" isPublic={true} shareToken="tok123" baseUrl="https://trippy.app" />)
      fireEvent.click(screen.getByRole('button', { name: /copy/i }))

      await waitFor(() => {
        expect(reportError).toHaveBeenCalledWith("Couldn't copy the link — please copy it manually.")
      })
    } finally {
      Object.assign(navigator, { clipboard: originalClipboard })
    }
  })
})
