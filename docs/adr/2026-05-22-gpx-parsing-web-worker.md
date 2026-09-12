# ADR: Move GPX parsing off the main thread

**Date:** 2026-05-22
**Status:** Accepted
**Related:** [FDR: Non-blocking GPX upload](../fdr/2026-05-22-gpx-parsing-web-worker.md)

## Context

`parseGPX` ran synchronously on the main thread. Large GPX files (50k+
points) froze the UI for the full parse duration during upload. The
existing parser used the `gpxparser` npm package, which depends on
`window.DOMParser` — unavailable inside a Web Worker — so moving the work
off the main thread required replacing the parsing library, not just
wrapping the existing one.

## Decision

- Replace `gpxparser` with `fast-xml-parser`, a pure-JS XML parser with no
  DOM dependency, usable in a worker, a browser tab, or Node.
- Add `src/workers/gpxWorker.ts` (the worker script) and
  `src/workers/gpxWorkerClient.ts` (a `parseGPXAsync` Promise wrapper
  hiding `postMessage` plumbing), so `App.tsx`'s call site changes from
  `parseGPX(text)` to `await parseGPXAsync(text)` — a one-line swap.
- Drop `gpxparser` and `@xmldom/xmldom` entirely, removing 85 transitive
  packages and their reported vulnerabilities along with them.
- Adopt Stryker mutation testing in the same change (`stryker.config.json`),
  used immediately to kill surviving mutants in `weatherService` and
  `haversineMeters`.
- Document the worker pattern (structured clone, Vite's `?worker` import)
  in `docs/learning/web-workers.md` for future contributors.

## Consequences

- `gpxParser.ts`'s core parsing function still exists in synchronous form
  for direct use in tests; the worker just calls it inside the worker
  context, so there are now two entry points (sync core, async client) to
  keep in sync.
- Mutation testing (Stryker) becomes a standing part of the test suite from
  this point forward — an unrelated tooling decision that landed in the
  same PR.
- The `?worker` import ties parsing to Vite's worker bundling; test
  coverage for `gpxWorkerClient.ts` mocks the worker boundary since jsdom
  cannot execute a real Worker.
