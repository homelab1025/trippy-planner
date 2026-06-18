import { useState } from 'react'
import { authApi, routesApi } from '../apiClient'
import type { CreateRouteRequest } from '../api'

interface Props {
  isAuthenticated: boolean
  routeData: CreateRouteRequest
  onSaved: (routeId: string) => void
}

type State = 'idle' | 'email-prompt' | 'sending' | 'sent' | 'saving'

export function SaveRouteButton({ isAuthenticated, routeData, onSaved }: Props) {
  const [state, setState] = useState<State>('idle')
  const [email, setEmail] = useState('')

  async function handleSave() {
    if (isAuthenticated) {
      setState('saving')
      const res = await routesApi.createRoute(routeData)
      onSaved(res.data.id as string)
      setState('idle')
    } else {
      setState('email-prompt')
    }
  }

  async function handleSendLink() {
    setState('sending')
    await authApi.requestMagicLink({ email })
    setState('sent')
  }

  if (state === 'sent') {
    return <p className="text-sm text-success">Check your email for a sign-in link.</p>
  }

  if (state === 'email-prompt' || state === 'sending') {
    return (
      <div className="flex flex-col gap-2">
        <input
          type="email"
          className="input input-bordered input-sm"
          placeholder="Your email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSendLink}
          disabled={state === 'sending'}
        >
          {state === 'sending' ? 'Sending…' : 'Send link'}
        </button>
      </div>
    )
  }

  return (
    <button
      className="btn btn-primary btn-sm"
      onClick={handleSave}
      disabled={state === 'saving'}
    >
      {state === 'saving' ? 'Saving…' : 'Save route'}
    </button>
  )
}
