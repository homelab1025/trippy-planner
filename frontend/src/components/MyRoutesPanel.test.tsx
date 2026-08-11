// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MyRoutesPanel } from './MyRoutesPanel'

const mocks = vi.hoisted(() => ({
  listRoutes: vi.fn(),
  getRoute: vi.fn(),
  createRoute: vi.fn(),
}))

vi.mock('../apiClient', () => ({
  routesApi: mocks,
}))

const sampleItems = [
  { id: 'uuid-1', name: 'Alpine Loop', avgSpeedKmh: 18, isPublic: false,
    startTime: '2026-06-17T08:00:00Z', createdAt: '2026-06-17T08:00:00Z' },
]

describe('MyRoutesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('fetches and lists routes on mount', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })

    render(<MyRoutesPanel onLoadRoute={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Alpine Loop')).toBeInTheDocument()
    })
  })

  it('calls onLoadRoute with GPX, id and name when route is clicked', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })
    mocks.getRoute.mockResolvedValue({ data: { ...sampleItems[0], gpxContent: '<gpx/>' } })

    const onLoadRoute = vi.fn()
    render(<MyRoutesPanel onLoadRoute={onLoadRoute} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByText('Alpine Loop'))

    await waitFor(() => {
      expect(onLoadRoute).toHaveBeenCalledWith('<gpx/>', 18, '2026-06-17T08:00:00Z', 'uuid-1', 'Alpine Loop')
    })
  })

  it('duplicates a route with a "(copy)" suffix without loading it, and refreshes the list', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })
    mocks.getRoute.mockResolvedValue({ data: { ...sampleItems[0], gpxContent: '<gpx/>' } })
    mocks.createRoute.mockResolvedValue({ data: { id: 'uuid-2' } })

    const onLoadRoute = vi.fn()
    render(<MyRoutesPanel onLoadRoute={onLoadRoute} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByRole('button', { name: /duplicate alpine loop/i }))

    await waitFor(() => {
      expect(mocks.createRoute).toHaveBeenCalledWith({
        name: 'Alpine Loop (copy)',
        gpxContent: '<gpx/>',
        avgSpeedKmh: 18,
        startTime: '2026-06-17T08:00:00Z',
      })
    })
    expect(onLoadRoute).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(mocks.listRoutes).toHaveBeenCalledTimes(2)
    })
  })

  it('shows the full name as a tooltip on the truncated route name', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })

    render(<MyRoutesPanel onLoadRoute={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Alpine Loop')).toHaveAttribute('title', 'Alpine Loop')
    })
  })
})
