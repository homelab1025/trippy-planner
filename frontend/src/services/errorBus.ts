export interface ErrorEntry {
  id: number;
  message: string;
}

type Listener = (entries: ErrorEntry[]) => void;

let entries: ErrorEntry[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener(entries);
}

export function reportError(message: string): void {
  entries = [...entries, { id: nextId++, message }];
  notify();
}

export function dismissError(id: number): void {
  entries = entries.filter(entry => entry.id !== id);
  notify();
}

export function subscribeErrors(listener: Listener): () => void {
  listeners.add(listener);
  listener(entries);
  return () => listeners.delete(listener);
}
