import { useState, type SubmitEvent } from 'react';
import { authApi } from '../apiClient';

interface Props {
  open: boolean;
  onClose: () => void;
}

type State = 'idle' | 'sending' | 'sent';

export function SignInPanel({ open, onClose }: Props) {
  const [state, setState] = useState<State>('idle');
  const [email, setEmail] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setState('idle');
      setEmail('');
    }
  }

  if (!open) return null;

  async function handleSendLink(e: SubmitEvent) {
    e.preventDefault();
    setState('sending');
    await authApi.requestMagicLink({ email });
    setState('sent');
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box relative">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
        <h3 className="font-bold text-lg mb-3">Sign in</h3>
        {state === 'sent' ? (
          <p className="text-sm text-success">Check your email for a sign-in link.</p>
        ) : (
          <form className="flex flex-col gap-2" onSubmit={handleSendLink}>
            <input
              type="email"
              className="input input-bordered input-sm w-full"
              placeholder="Your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm w-full"
              disabled={state === 'sending'}
            >
              {state === 'sending' ? 'Sending…' : 'Send link'}
            </button>
          </form>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
