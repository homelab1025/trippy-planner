/// <reference lib="WebWorker" />
import { parseGPX } from '../utils/gpxParser';

self.onmessage = (e: MessageEvent<string>) => {
  try {
    const data = parseGPX(e.data);
    self.postMessage({ type: 'success', data });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
