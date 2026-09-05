import { useState } from 'react';
import { routesApi } from '../apiClient';
import type { CreateRouteRequest } from '../api';

interface Props {
  isAuthenticated: boolean;
  name: string;
  onNameChange: (name: string) => void;
  routeData: Omit<CreateRouteRequest, 'name'>;
  savedRouteId: string | null;
  onSaved: (routeId: string) => void;
  onRequireAuth: () => void;
}

type State = 'idle' | 'saving';

export function SaveRouteButton({ isAuthenticated, name, onNameChange, routeData, savedRouteId, onSaved, onRequireAuth }: Props) {
  const [state, setState] = useState<State>('idle');

  async function handleSave(saveAsNew: boolean) {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setState('saving');
    if (savedRouteId && !saveAsNew) {
      const res = await routesApi.updateRoute(savedRouteId, {
        name,
        avgSpeedKmh: routeData.avgSpeedKmh,
        startTime: routeData.startTime,
        checkpointsJson: routeData.checkpointsJson,
      });
      onSaved(res.data.id as string);
    } else {
      const res = await routesApi.createRoute({ name, ...routeData });
      onSaved(res.data.id as string);
    }
    setState('idle');
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <label htmlFor="route-name" className="label pb-1">
          <span className="label-text">Route name</span>
        </label>
        <input
          id="route-name"
          className="input input-bordered input-sm w-full"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Route name"
        />
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-primary btn-sm flex-1 whitespace-nowrap"
          onClick={() => handleSave(false)}
          disabled={state === 'saving'}
        >
          {state === 'saving' ? 'Saving…' : savedRouteId ? 'Save' : 'Save route'}
        </button>
        {savedRouteId && (
          <button
            className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
            onClick={() => handleSave(true)}
            disabled={state === 'saving'}
          >
            Save as new
          </button>
        )}
      </div>
    </div>
  );
}
