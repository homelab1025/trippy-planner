import { useEffect, useState } from 'react'
import { routesApi } from '../apiClient'
import type { RouteListItem } from '../api'

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
