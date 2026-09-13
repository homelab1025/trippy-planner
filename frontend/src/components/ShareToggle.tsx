import { useState } from 'react'
import { routesApi } from '../apiClient'
import { reportError } from '../services/errorBus'

interface Props {
  routeId: string
  isPublic: boolean
  shareToken: string | null
  baseUrl: string
}

export function ShareToggle({ routeId, isPublic, shareToken, baseUrl }: Props) {
  const [currentToken, setCurrentToken] = useState(shareToken)
  const [isShared, setIsShared] = useState(isPublic)
  const [busy, setBusy] = useState(false)
  const shareUrl = currentToken ? `${baseUrl}/share/${currentToken}` : null

  async function handleShare() {
    setBusy(true)
    try {
      const res = await routesApi.shareRoute(routeId)
      setCurrentToken(res.data.shareToken as string)
      setIsShared(true)
    } catch {
      reportError("Couldn't create a share link. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleUnshare() {
    setBusy(true)
    try {
      await routesApi.unshareRoute(routeId)
      setCurrentToken(null)
      setIsShared(false)
    } catch {
      reportError("Couldn't stop sharing. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      reportError("Couldn't copy the link — please copy it manually.")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {shareUrl && (
        <div className="flex items-center gap-2">
          <span className="text-xs truncate flex-1">{shareUrl}</span>
          <button className="btn btn-ghost btn-xs" onClick={handleCopy}>
            Copy
          </button>
        </div>
      )}
      {isShared ? (
        <button className="btn btn-outline btn-sm w-full" onClick={handleUnshare} disabled={busy}>
          Stop sharing
        </button>
      ) : (
        <button className="btn btn-outline btn-sm w-full" onClick={handleShare} disabled={busy}>
          Share
        </button>
      )}
    </div>
  )
}
