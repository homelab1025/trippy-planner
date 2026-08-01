import { describe, it, expect, beforeEach } from 'vitest';
import { loadStoredRoute, saveStoredRoute, clearStoredRoute } from './routeStorage';

const sampleRoute = {
  name: 'My Ride',
  gpxContent: '<gpx/>',
  avgSpeedKmh: 22,
  startTime: '2026-08-01T10:00:00.000Z',
};

describe('routeStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(loadStoredRoute()).toBeNull();
  });

  it('round-trips a saved route', () => {
    saveStoredRoute(sampleRoute);
    expect(loadStoredRoute()).toEqual(sampleRoute);
  });

  it('returns null and clears the key when the stored value is corrupted JSON', () => {
    localStorage.setItem('trippy_current_route', 'not-json{');
    expect(loadStoredRoute()).toBeNull();
    expect(localStorage.getItem('trippy_current_route')).toBeNull();
  });

  it('clearStoredRoute removes the stored route', () => {
    saveStoredRoute(sampleRoute);
    clearStoredRoute();
    expect(loadStoredRoute()).toBeNull();
  });

  it('saveStoredRoute does not throw when localStorage.setItem throws', () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    expect(() => saveStoredRoute(sampleRoute)).not.toThrow();
    localStorage.setItem = original;
  });
});
