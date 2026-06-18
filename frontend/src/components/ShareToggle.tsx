import { useState } from 'react'
import { routesApi } from '../apiClient'

interface Props {
  routeId: string
  isPublic: boolean
  shareToken: string | null
  baseUrl: string
}

export function ShareToggle({ routeId, isPublic, shareToken, baseUrl }: Props) {
  const [currentToken, setCurrentToken] = useState(shareToken)
  const [isShared, setIsShared] = useState(isPublic)

  async function handleShare() {
    const res = await routesApi.shareRoute(routeId)
    setCurrentToken(res.data.shareToken as string)
    setIsShared(true)
  }

  async function handleUnshare() {
    await routesApi.unshareRoute(routeId)
    setCurrentToken(null)
    setIsShared(false)
  }

  const shareUrl = currentToken ? `${baseUrl}/share/${currentToken}` : null

  return (
    <div className="flex flex-col gap-2">
      {shareUrl && (
        <div className="flex items-center gap-2">
          <span className="text-xs truncate flex-1">{shareUrl}</span>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
          >
            Copy
          </button>
        </div>
      )}
      {isShared ? (
        <button className="btn btn-outline btn-xs" onClick={handleUnshare}>
          Stop sharing
        </button>
      ) : (
        <button className="btn btn-outline btn-xs" onClick={handleShare}>
          Share
        </button>
      )}
    </div>
  )
}
