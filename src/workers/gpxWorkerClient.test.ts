import { describe, it, expect, vi } from 'vitest';
import type { RouteData } from '../utils/gpxParser';

let workerInstance: FakeWorker;

class FakeWorker {
  private listeners: Map<string, Set<(e: unknown) => void>> = new Map();
  postMessage = vi.fn();
  terminate = vi.fn();

  addEventListener(type: string, handler: (e: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: (e: unknown) => void) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type: string, payload: unknown) {
    this.listeners.get(type)?.forEach(h => h(payload));
  }
}

vi.mock('./gpxWorker?worker', () => ({
  // Must be a regular function (not arrow) so it can be called with `new`
  default: function GpxWorkerMock() {
    workerInstance = new FakeWorker();
    return workerInstance;
  },
}));

const { parseGPXAsync } = await import('./gpxWorkerClient');

const minimalRoute: RouteData = {
  name: 'Test Route',
  originalPointCount: 1,
  totalDistance: 1000,
  totalElevationGain: 50,
  points: [{ lat: 48.8, lng: 2.3, ele: 100, distance: 0 }],
};

describe('parseGPXAsync', () => {
  it('resolves with RouteData when the worker posts a success response', async () => {
    const promise = parseGPXAsync('<gpx/>', 5, Infinity);
    workerInstance.emit('message', { data: { type: 'success', data: minimalRoute } });
    await expect(promise).resolves.toEqual(minimalRoute);
  });

  it('rejects with the error message when the worker posts an error response', async () => {
    const promise = parseGPXAsync('<bad/>', 5, Infinity);
    workerInstance.emit('message', { data: { type: 'error', message: 'No tracks found' } });
    await expect(promise).rejects.toThrow('No tracks found');
  });

  it('rejects when the worker fires an error event', async () => {
    const promise = parseGPXAsync('<gpx/>', 5, Infinity);
    workerInstance.emit('error', { message: 'Worker crashed' });
    await expect(promise).rejects.toThrow('Worker crashed');
  });

  it('sends xml, epsilon, and maxGapMeters to the worker as a structured message', async () => {
    const xml = '<gpx version="1.1"/>';
    const promise = parseGPXAsync(xml, 10, 500);
    workerInstance.emit('message', { data: { type: 'success', data: minimalRoute } });
    await promise;
    expect(workerInstance.postMessage).toHaveBeenCalledWith({ xml, epsilon: 10, maxGapMeters: 500 });
  });

  it('terminates the worker after a successful response', async () => {
    const promise = parseGPXAsync('<gpx/>', 5, Infinity);
    workerInstance.emit('message', { data: { type: 'success', data: minimalRoute } });
    await promise;
    expect(workerInstance.terminate).toHaveBeenCalledOnce();
  });

  it('terminates the worker after an error response', async () => {
    const promise = parseGPXAsync('<bad/>', 5, Infinity);
    workerInstance.emit('message', { data: { type: 'error', message: 'No tracks found' } });
    await expect(promise).rejects.toThrow('No tracks found');
    expect(workerInstance.terminate).toHaveBeenCalledOnce();
  });

  it('terminates the worker after a worker error event', async () => {
    const promise = parseGPXAsync('<gpx/>', 5, Infinity);
    workerInstance.emit('error', { message: 'Worker crashed' });
    await expect(promise).rejects.toThrow('Worker crashed');
    expect(workerInstance.terminate).toHaveBeenCalledOnce();
  });
});
