import { useState } from 'react';
import { routesApi } from '../apiClient';
import type { CreateRouteRequest } from '../api';

interface Props {
  isAuthenticated: boolean;
  routeData: CreateRouteRequest;
  onSaved: (routeId: string) => void;
  onRequireAuth: () => void;
}

type State = 'idle' | 'saving';

export function SaveRouteButton({ isAuthenticated, routeData, onSaved, onRequireAuth }: Props) {
  const [state, setState] = useState<State>('idle');

  async function handleSave() {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setState('saving');
    const res = await routesApi.createRoute(routeData);
    onSaved(res.data.id as string);
    setState('idle');
  }

  return (
    <button
      className="btn btn-primary btn-sm w-full"
      onClick={handleSave}
      disabled={state === 'saving'}
    >
      {state === 'saving' ? 'Saving…' : 'Save route'}
    </button>
  );
}
