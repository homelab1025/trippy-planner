import { useEffect, useState } from 'react';
import { subscribeErrors, dismissError, type ErrorEntry } from '../services/errorBus';

export function ErrorPanel(): JSX.Element | null {
  const [entries, setEntries] = useState<ErrorEntry[]>([]);

  useEffect(() => subscribeErrors(setEntries), []);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {entries.map(entry => (
        <div key={entry.id} role="alert" className="alert alert-error shadow flex items-start justify-between">
          <span className="text-sm">{entry.message}</span>
          <button
            className="btn btn-ghost btn-xs btn-circle"
            aria-label={`Dismiss: ${entry.message}`}
            onClick={() => dismissError(entry.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
