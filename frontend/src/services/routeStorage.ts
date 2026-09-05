const STORAGE_KEY = 'trippy_current_route';

export interface StoredRoute {
  name: string;
  gpxContent: string;
  avgSpeedKmh: number;
  startTime: string;
  id?: string;
  dpEpsilonMeters?: number;
  dpMaxGapMeters?: number;
  checkpointsJson?: string;
}

export function loadStoredRoute(): StoredRoute | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredRoute;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveStoredRoute(route: StoredRoute): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(route));
  } catch (error) {
    console.warn('Failed to persist route to localStorage:', error);
  }
}

export function clearStoredRoute(): void {
  localStorage.removeItem(STORAGE_KEY);
}
