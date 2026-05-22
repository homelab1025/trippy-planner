import GpxWorker from './gpxWorker?worker';
import type { RouteData } from '../utils/gpxParser';

type WorkerResponse =
  | { type: 'success'; data: RouteData }
  | { type: 'error'; message: string };

export function parseGPXAsync(xmlText: string): Promise<RouteData> {
  return new Promise((resolve, reject) => {
    const worker = new GpxWorker();
    worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      worker.terminate();
      if (e.data.type === 'success') resolve(e.data.data);
      else reject(new Error(e.data.message));
    });
    worker.addEventListener('error', (e: ErrorEvent) => {
      worker.terminate();
      reject(new Error(e.message));
    });
    worker.postMessage(xmlText);
  });
}
