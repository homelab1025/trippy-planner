# Web Workers

## What are they?

A Web Worker is a script that runs in a background thread, separate from the browser's main thread. The main thread is responsible for rendering the UI and running JavaScript event handlers. When you run heavy computation on the main thread, the page freezes until it finishes — no scrolling, no clicks, nothing.

Workers solve this by moving the work off the main thread. While the worker runs, the main thread stays free to respond to user input.

**Key constraints:**
- Workers have no access to the DOM (`document`, `window`, HTML elements).
- Workers can use most Web APIs (`fetch`, `setTimeout`, `crypto`, etc.).
- Workers have their own global scope (`self`, not `window`).
- Workers cannot share memory with the main thread by default (see `SharedArrayBuffer` for the exception, which requires special headers).

## How communication works

Main thread and worker talk through `postMessage` and `onmessage`. Each message is a copy, not a reference — the browser uses the **structured clone algorithm** to serialize and deserialize the value as it crosses the thread boundary.

```
Main thread                          Worker thread
──────────────────────────────────   ──────────────────────────────────
worker.postMessage(data)  ────────►  self.onmessage = (e) => {
                                       // e.data is a deep clone of data
                                       self.postMessage(result);
                          ◄────────  }
self.onmessage = (e) => {
  // e.data is a deep clone of result
}
```

## What can and cannot be transferred

The structured clone algorithm handles most plain data:

| Can transfer | Cannot transfer |
|---|---|
| Primitives (`number`, `string`, `boolean`) | Functions |
| Plain objects and arrays | DOM nodes (`HTMLElement`, etc.) |
| `Date`, `RegExp`, `Map`, `Set` | Class instances with methods |
| `ArrayBuffer`, `TypedArray` | Anything tied to the main thread context |
| `Blob`, `File` | |

`ArrayBuffer` (and views like `Uint8Array`) can also be **transferred** instead of cloned — ownership moves to the worker and the original becomes detached. This avoids copying large binary data:

```js
const buffer = new ArrayBuffer(1024 * 1024);
worker.postMessage(buffer, [buffer]); // buffer is now empty on the main thread
```

## Vanilla JS example

**worker.js**
```js
self.onmessage = (e) => {
  const numbers = e.data; // array of numbers cloned from main thread
  const sum = numbers.reduce((a, b) => a + b, 0);
  self.postMessage(sum);
};
```

**main.js**
```js
const worker = new Worker(new URL('./worker.js', import.meta.url));

worker.onmessage = (e) => {
  console.log('Sum:', e.data);
};

worker.onerror = (e) => {
  console.error('Worker error:', e.message);
};

worker.postMessage([1, 2, 3, 4, 5]);
```

The worker is created once and can receive many messages. Call `worker.terminate()` to shut it down early.

## Vite's `?worker` import

Vite has built-in support for web workers. Instead of constructing a `Worker` with a URL manually, you import the worker file with a `?worker` query parameter:

```ts
import MyWorker from './myWorker?worker';

const worker = new MyWorker(); // same API as `new Worker(...)`
```

Vite bundles the worker file (and all its imports, including npm packages) into a separate chunk at build time. In development it serves it as a separate module. No extra configuration required.

Other query variants:
- `?worker&inline` — inlines the worker as a base64 data URL (avoids a separate request, useful for small workers).
- `?sharedworker` — creates a `SharedWorker` instead of a `Worker`.

## TypeScript typing

The main thread's `Worker` type is provided by the `DOM` lib. The worker script itself needs the `WebWorker` lib for `self` to be typed as `DedicatedWorkerGlobalScope` (not `Window`).

Add this triple-slash directive at the top of your worker file:

```ts
/// <reference lib="WebWorker" />
```

This gives you proper types for `self.onmessage`, `self.postMessage`, and other worker-specific APIs in that file only, without changing your project-wide `tsconfig.json`.

## Pattern used in this project

`src/workers/gpxWorker.ts` is the worker script. It receives a raw GPX XML string, calls `parseGPX`, and posts back either a `{ type: 'success', data: RouteData }` or `{ type: 'error', message: string }` response.

`src/workers/gpxWorkerClient.ts` wraps the worker in a Promise and exports a single function:

```ts
parseGPXAsync(xmlText: string): Promise<RouteData>
```

The caller (`App.tsx`) sees a normal async function — no postMessage plumbing visible at the call site. The worker is a singleton created at module load time and reused across uploads.

This is a common pattern: keep the worker file minimal (receive → process → respond) and put all the Promise wrapping and error handling in a separate "client" module.
