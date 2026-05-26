# Configurable DP Epsilon — Design Spec

**Date:** 2026-05-23
**Branch:** feat/douglas-peucker-decimation
**Status:** Approved

## Problem

`DP_EPSILON_METERS` is a compile-time constant. Users cannot tune the decimation tolerance without editing source code and rebuilding.

## Goal

Make the epsilon value editable in the Tech Details sidebar panel before a GPX file is uploaded, then freeze it once parsing begins. The other Tech Details fields (Original Points, Map Points) populate as before, after upload.

---

## State

`App.tsx` gains one new piece of state:

```typescript
const [dpEpsilon, setDpEpsilon] = useState(DP_EPSILON_METERS);
```

`dpEpsilon` is passed to `parseGPXAsync` on upload. It is reset only by page refresh — uploading a new file re-uses the frozen value from the previous upload unless the user refreshes.

---

## Worker Message Format

Currently `gpxWorkerClient.ts` sends a raw XML string. It changes to a typed object:

```typescript
type WorkerMessage = { xml: string; epsilon: number };
```

`gpxWorker.ts` destructures this message and passes `epsilon` to `parseGPX`.

---

## `parseGPX` Signature

```typescript
export const parseGPX = (xmlText: string, epsilon: number): RouteData
```

`epsilon` replaces the direct reference to `DP_EPSILON_METERS` inside the function body. The constant itself stays exported from `douglasPeucker.ts` — used as the `useState` default in `App.tsx` and as the default in tests.

---

## UI — Tech Details Panel

The panel moves out of the `{route && (...)}` guard and is always visible in the sidebar.

| Field | Before upload | After upload |
|---|---|---|
| DP Epsilon | `<input>` editable, value = `dpEpsilon` | `<input>` disabled |
| Original Points | `—` | `route.originalPointCount.toLocaleString()` |
| Map Points | `—` | `route.points.length.toLocaleString()` |

Input constraints: `type="number"`, `min="1"`, `step="1"`. The `onChange` handler clamps the value to a minimum of 1 before calling `setDpEpsilon` — `min` alone only prevents form submission, not programmatic state updates.

The input is disabled (not hidden) when `route !== null`, making the frozen state visually clear.

---

## What Does Not Change

- `douglasPeucker.ts` — algorithm and `DP_EPSILON_METERS` constant unchanged
- `MapComponent.tsx` — unchanged
- `WeatherTimeline.tsx` — unchanged
- `gpxParser.test.ts` — tests pass `DP_EPSILON_METERS` explicitly as the epsilon argument; behavior is identical

---

## Testing

- `gpxParser.test.ts`: update `parseGPX` calls to pass `DP_EPSILON_METERS` as second argument (or a custom value where relevant)
- `gpxWorkerClient.test.ts`: update mock to accept the new `{ xml, epsilon }` message format
- No new unit tests needed — the UI epsilon binding is wired state, not new logic
