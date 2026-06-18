/// <reference lib="WebWorker" />
import { parseGPX } from '../utils/gpxParser';

type WorkerMessage = { xml: string; epsilon: number; maxGapMeters: number };

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  try {
    const data = parseGPX(e.data.xml, e.data.epsilon, e.data.maxGapMeters);
    self.postMessage({ type: 'success', data });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
