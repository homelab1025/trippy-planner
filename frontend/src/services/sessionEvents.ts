type Listener = () => void;

const listeners = new Set<Listener>();

export function notifySessionExpired(): void {
  for (const listener of listeners) listener();
}

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
