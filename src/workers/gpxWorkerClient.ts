import GpxWorker from './gpxWorker?worker';
import type { RouteData } from '../utils/gpxParser';

type WorkerResponse =
  | { type: 'success'; data: RouteData }
  | { type: 'error'; message: string };

const worker = new GpxWorker();

export function parseGPXAsync(xmlText: string): Promise<RouteData> {
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      cleanup();
      if (e.data.type === 'success') resolve(e.data.data);
      else reject(new Error(e.data.message));
    };
    const onError = (e: ErrorEvent) => {
      cleanup();
      reject(new Error(e.message));
    };
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage(xmlText);
  });
}
