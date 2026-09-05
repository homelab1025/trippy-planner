// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { format } from 'date-fns'
import { MyRoutesPanel } from './MyRoutesPanel'

const mocks = vi.hoisted(() => ({
  listRoutes: vi.fn(),
  getRoute: vi.fn(),
  createRoute: vi.fn(),
  deleteRoute: vi.fn(),
}))

vi.mock('../apiClient', () => ({
  routesApi: mocks,
}))

const sampleItems = [
  { id: 'uuid-1', name: 'Alpine Loop', avgSpeedKmh: 18, isPublic: false,
    startTime: '2026-06-17T08:00:00Z', createdAt: '2026-06-17T08:00:00Z' },
]

const expectedDate = format(new Date(sampleItems[0].startTime), 'd MMM yyyy')

describe('MyRoutesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('fetches and lists routes on mount', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })

    render(<MyRoutesPanel onLoadRoute={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Alpine Loop')).toBeInTheDocument()
    })
  })

  it('calls onLoadRoute with GPX, id, name, and checkpointsJson when route is clicked', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })
    mocks.getRoute.mockResolvedValue({ data: { ...sampleItems[0], gpxContent: '<gpx/>', checkpointsJson: '[{"id":"end","distanceM":1000}]' } })

    const onLoadRoute = vi.fn()
    render(<MyRoutesPanel onLoadRoute={onLoadRoute} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByText('Alpine Loop'))

    await waitFor(() => {
      expect(onLoadRoute).toHaveBeenCalledWith('<gpx/>', 18, '2026-06-17T08:00:00Z', 'uuid-1', 'Alpine Loop', '[{"id":"end","distanceM":1000}]')
    })
  })

  it('duplicates a route with a "(copy)" suffix without loading it, and carries checkpointsJson over', async () => {
    const duplicatedItem = { ...sampleItems[0], id: 'uuid-2', name: 'Alpine Loop (copy)' }
    mocks.listRoutes
      .mockResolvedValueOnce({ data: sampleItems }) // initial mount
      .mockResolvedValueOnce({ data: [...sampleItems, duplicatedItem] }) // after duplicate
    mocks.getRoute.mockResolvedValue({ data: { ...sampleItems[0], gpxContent: '<gpx/>', checkpointsJson: '[{"id":"end","distanceM":1000}]' } })
    mocks.createRoute.mockResolvedValue({ data: { id: 'uuid-2' } })

    const onLoadRoute = vi.fn()
    render(<MyRoutesPanel onLoadRoute={onLoadRoute} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByRole('button', { name: /duplicate alpine loop/i }))

    await waitFor(() => {
      expect(mocks.createRoute).toHaveBeenCalledWith({
        name: 'Alpine Loop (copy)',
        gpxContent: '<gpx/>',
        avgSpeedKmh: 18,
        startTime: '2026-06-17T08:00:00Z',
        checkpointsJson: '[{"id":"end","distanceM":1000}]',
      })
    })
    expect(onLoadRoute).not.toHaveBeenCalled()
    await screen.findByText('Alpine Loop (copy)') // the list now shows the duplicate
  })

  it('shows the full name as a tooltip on the truncated route name', async () => {
    mocks.listRoutes.mockResolvedValue({ data: sampleItems })

    render(<MyRoutesPanel onLoadRoute={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Alpine Loop')).toHaveAttribute('title', 'Alpine Loop')
    })
  })

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
})
