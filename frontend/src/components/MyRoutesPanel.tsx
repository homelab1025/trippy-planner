import { useEffect, useState, useCallback } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { routesApi } from '../apiClient'
import type { RouteListItem } from '../api'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  onLoadRoute: (gpxContent: string, avgSpeedKmh: number, startTime: string, id: string, name: string, checkpointsJson?: string) => void
  onDeleted: (id: string) => void
  refreshKey?: string
}

const NOT_FETCHED = Symbol('not-fetched')

export function MyRoutesPanel({ onLoadRoute, onDeleted, refreshKey }: Props) {
  const [routes, setRoutes] = useState<RouteListItem[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | typeof NOT_FETCHED | undefined>(NOT_FETCHED)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string; startTime: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
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
    onLoadRoute(res.data.gpxContent as string, avgSpeedKmh, startTime, id, name, res.data.checkpointsJson as string | undefined)
  }

  async function handleDuplicate(e: React.MouseEvent, id: string, name: string, avgSpeedKmh: number, startTime: string) {
    e.stopPropagation()
    const res = await routesApi.getRoute(id)
    await routesApi.createRoute({
      name: `${name} (copy)`,
      gpxContent: res.data.gpxContent as string,
      avgSpeedKmh,
      startTime,
      checkpointsJson: res.data.checkpointsJson as string | undefined,
    })
    await fetchRoutes()
  }

  function handleDeleteClick(e: React.MouseEvent, id: string, name: string, startTime: string) {
    e.stopPropagation()
    setPendingDelete({ id, name, startTime })
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    await routesApi.deleteRoute(pendingDelete.id)
    await fetchRoutes()
    setDeleting(false)
    const id = pendingDelete.id
    setPendingDelete(null)
    onDeleted(id)
  }

  function handleCancelDelete() {
    setPendingDelete(null)
  }

  if (loading) return <p className="text-sm text-base-content/50">Loading routes…</p>
  if (routes.length === 0) return <p className="text-sm text-base-content/50">No saved routes yet.</p>

  return (
    <>
      <ul className="menu menu-sm w-full min-w-0">
        {routes.map(r => {
          const id = r.id as string
          const name = r.name as string
          const avgSpeedKmh = r.avgSpeedKmh as number
          const startTime = r.startTime as string
          return (
            <li key={id} className="min-w-0">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
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
                <button
                  aria-label={`Delete ${name}`}
                  className="btn btn-ghost btn-xs px-1"
                  onClick={(e) => handleDeleteClick(e, id, name, startTime)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete route"
        message={pendingDelete ? `Delete '${pendingDelete.name}' on the ${format(new Date(pendingDelete.startTime), 'd MMM yyyy')}?` : ''}
        confirming={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  )
}
