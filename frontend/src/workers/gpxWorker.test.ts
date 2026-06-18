import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RouteData } from '../utils/gpxParser';

vi.mock('../utils/gpxParser', () => ({ parseGPX: vi.fn() }));

// Node test env doesn't have 'self'; alias it to globalThis for the worker import.
(globalThis as any).self = globalThis;

const { parseGPX } = await import('../utils/gpxParser');
const parseGPXMock = vi.mocked(parseGPX);

// Importing the worker registers self.onmessage = handler
await import('./gpxWorker');

const fire = (data: { xml: string; epsilon: number; maxGapMeters: number }) =>
  (globalThis as any).onmessage({ data });

const minimalRoute: RouteData = {
  name: 'R',
  originalPointCount: 1,
  totalDistance: 0,
  totalElevationGain: 0,
  points: [{ lat: 0, lng: 0, ele: 0, distance: 0 }],
};

describe('gpxWorker onmessage', () => {
  let postMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessage = vi.fn();
    (globalThis as any).postMessage = postMessage;
    parseGPXMock.mockReset();
  });

  it('posts { type: "success", data } with the RouteData returned by parseGPX', () => {
    parseGPXMock.mockReturnValue(minimalRoute);
    fire({ xml: '<gpx/>', epsilon: 5, maxGapMeters: Infinity });
    expect(postMessage).toHaveBeenCalledWith({ type: 'success', data: minimalRoute });
  });

  it('posts { type: "error", message } when parseGPX throws an Error', () => {
    parseGPXMock.mockImplementation(() => { throw new Error('No tracks found'); });
    fire({ xml: '<bad/>', epsilon: 5, maxGapMeters: Infinity });
    expect(postMessage).toHaveBeenCalledWith({ type: 'error', message: 'No tracks found' });
  });

  it('posts { type: "error", message } coercing a non-Error thrown value via String()', () => {
    parseGPXMock.mockImplementation(() => { throw 'raw string error'; });
    fire({ xml: '<bad/>', epsilon: 5, maxGapMeters: Infinity });
    expect(postMessage).toHaveBeenCalledWith({ type: 'error', message: 'raw string error' });
  });
});
