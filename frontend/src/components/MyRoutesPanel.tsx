import { useEffect, useState, useCallback } from 'react'
import { Copy } from 'lucide-react'
import { routesApi } from '../apiClient'
import type { RouteListItem } from '../api'

interface Props {
  onLoadRoute: (gpxContent: string, avgSpeedKmh: number, startTime: string, id: string, name: string) => void
  refreshKey?: string
}

const NOT_FETCHED = Symbol('not-fetched')

export function MyRoutesPanel({ onLoadRoute, refreshKey }: Props) {
  const [routes, setRoutes] = useState<RouteListItem[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | typeof NOT_FETCHED | undefined>(NOT_FETCHED)
  const loading = fetchedFor !== refreshKey

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

  async function handleClick(id: string, avgSpeedKmh: number, startTime: string, name: string) {
    const res = await routesApi.getRoute(id)
    onLoadRoute(res.data.gpxContent as string, avgSpeedKmh, startTime, id, name)
  }

  async function handleDuplicate(e: React.MouseEvent, id: string, name: string, avgSpeedKmh: number, startTime: string) {
    e.stopPropagation()
    const res = await routesApi.getRoute(id)
    await routesApi.createRoute({
      name: `${name} (copy)`,
      gpxContent: res.data.gpxContent as string,
      avgSpeedKmh,
      startTime,
    })
    await fetchRoutes()
  }

  if (loading) return <p className="text-sm text-base-content/50">Loading routes…</p>
  if (routes.length === 0) return <p className="text-sm text-base-content/50">No saved routes yet.</p>

  return (
    <ul className="menu menu-sm w-full min-w-0">
      {routes.map(r => {
        const id = r.id as string
        const name = r.name as string
        const avgSpeedKmh = r.avgSpeedKmh as number
        const startTime = r.startTime as string
        return (
          <li key={id} className="min-w-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <button
                className="text-left grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-w-0"
                onClick={() => handleClick(id, avgSpeedKmh, startTime, name)}
              >
                <span className="truncate block min-w-0" title={name}>{name}</span>
                <span className="text-xs text-base-content/50">{avgSpeedKmh} km/h</span>
              </button>
              <button
                aria-label={`Duplicate ${name}`}
                className="btn btn-ghost btn-xs px-1"
                onClick={(e) => handleDuplicate(e, id, name, avgSpeedKmh, startTime)}
              >
                <Copy size={14} />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
