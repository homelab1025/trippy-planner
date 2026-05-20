# Trippy Planner — Source Code Walkthrough

This guide explains how the codebase is organized and why, written for someone coming from Java.

---

## The Big Picture: How It Compares to a Java App

In Java you'd probably have a Spring Boot backend serving REST endpoints, a layered package structure (`controller`, `service`, `repository`), and a separate frontend or template engine. This app is different in two ways:

1. **There is no backend.** Everything runs in the browser. The "backend" equivalent is the Open-Meteo public API, which the browser calls directly.
2. **React is the UI framework.** Instead of rendering HTML on a server and sending it to the browser, React builds and updates the DOM client-side in response to state changes — think of it as a very reactive Swing or JavaFX, but for the web.

The language is **TypeScript**, which is JavaScript with a type system bolted on. If you squint, the types look a lot like Java: `interface`, generics (`Array<T>`), `readonly`, etc. The main differences:
- No classes needed for most things — functions are first-class and widely used instead.
- `interface` describes shape, not behaviour (no method bodies).
- `export` / `import` replace Java's package visibility model.
- Types are erased at runtime; they only exist for the compiler.

---

## Project Layout

```
src/
  main.tsx              # Entry point — mounts the React app into the HTML page
  App.tsx               # Root component — owns all application state
  App.css               # Global styles for App
  index.css             # Base/reset styles
  utils/
    gpxParser.ts        # Pure function: XML string → RouteData
  services/
    weatherService.ts   # Async function: coordinates + time → WeatherData
  components/
    MapComponent.tsx    # Renders the Leaflet map
    WeatherTimeline.tsx # Renders the elevation + temperature chart
tests/
  app.spec.ts           # Playwright end-to-end tests
public/
  sample-route.gpx      # A real GPX file used during manual and automated testing
```

This mirrors the Java layering you know — `utils` is like a pure helper class, `services` is like a service bean, `components` is like view controllers. The difference is that there's no dependency injection framework; components just `import` what they need directly.

---

## Entry Point: `main.tsx`

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

This is the `main()` method of the app. It finds the `<div id="root">` element in `index.html` and hands it to React to manage from that point on. The `!` after `getElementById` is TypeScript telling the compiler "trust me, this element is not null" — without it the compiler complains about a possible `null` value, similar to a `NullPointerException` guard.

`StrictMode` is a React development helper that intentionally runs certain lifecycle hooks twice to surface bugs — you can ignore it in production.

**TypeScript concept — non-null assertion (`!`):** JavaScript's DOM APIs return `Element | null`. TypeScript forces you to handle both cases. The `!` postfix asserts it is never null, bypassing the null check. The safer alternative is an explicit `if (!el) throw new Error(...)`.

---

## State Container: `App.tsx`

This is the heart of the application. In Java terms, think of it as a stateful `@Controller` that also owns the view.

### State

```ts
const [route, setRoute] = useState<RouteData | null>(null);
const [avgSpeed, setAvgSpeed] = useState(25);
const [startTime, setStartTime] = useState<Date>(new Date());
const [weatherPoints, setWeatherPoints] = useState<(WeatherData & { point: RoutePoint; arrivalTime: Date })[]>([]);
const [loading, setLoading] = useState(false);
const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
```

`useState` is React's equivalent of a private field — but whenever you call the setter (`setRoute`, etc.), React re-renders the component with the new value. You never mutate the variable directly; you always go through the setter.

**TypeScript concept — union types (`RouteData | null`):** This is like `Optional<RouteData>` in Java. The compiler forces you to check for null before using the value.

**TypeScript concept — intersection types (`WeatherData & { point: RoutePoint; arrivalTime: Date }`):** The `&` merges two types into one — like implementing two interfaces at once. `weatherPoints` is an array of objects that have every field from `WeatherData` *plus* `point` and `arrivalTime`.

### Reactive re-fetching with `useEffect`

```ts
React.useEffect(() => {
  if (route) {
    updateWeather(route, avgSpeed, startTime);
  }
}, [route, avgSpeed, startTime, updateWeather]);
```

`useEffect` is React's observer pattern. The second argument — `[route, avgSpeed, startTime, updateWeather]` — is the dependency list. Whenever any of those values change, React calls the function body again. This is how changing the date or speed automatically triggers a weather refresh with no explicit wiring.

In Java you might achieve the same with a `PropertyChangeListener` or reactive streams. Here it's built into the framework.

### `useCallback` — referential stability

```ts
const updateWeather = useCallback(async (...) => { ... }, []);
```

Functions in JavaScript are recreated on every render. If `updateWeather` were a plain function, it would be a different object reference every render, which would trigger the `useEffect` in an infinite loop. `useCallback` memoizes the function so its reference stays stable. The empty dependency array `[]` means "create this function once and never recreate it."

### Async file handling

```ts
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  const text = await file.text();
  const parsedRoute = parseGPX(text);
  ...
};
```

**TypeScript concept — optional chaining (`?.`):** `files?.[0]` means "if `files` is null or undefined, return undefined instead of throwing." Equivalent to `files != null ? files[0] : null` in Java.

**TypeScript concept — `async`/`await`:** Works exactly like Java's `CompletableFuture.thenApply(...)` chain, but with much cleaner syntax. `await` suspends the current function until the Promise resolves, without blocking the browser's main thread.

---

## Pure Utility: `src/utils/gpxParser.ts`

```ts
export interface RoutePoint {
  lat: number;
  lng: number;
  ele: number;
  time?: Date;       // optional — not all GPX files include timestamps
  distance: number;
}

export interface RouteData {
  points: RoutePoint[];
  totalDistance: number;
  totalElevationGain: number;
  name: string;
}

export const parseGPX = (xmlText: string): RouteData => { ... };
```

This module has no side effects — it takes a string, returns a plain data object. In Java this would be a `static` utility method on a helper class. Here it's just an exported function.

**TypeScript concept — `interface`:** Like a Java `interface` but with only field declarations. No method bodies. It purely describes the shape of an object at compile time and disappears at runtime.

**TypeScript concept — optional field (`time?`):** The `?` marks a field as optional — it may or may not be present. Accessing it without a null check produces a compiler warning.

**Why the `as any` cast at line 32?**

```ts
distance: (track.distance as any).cumul[i] || 0,
```

The `gpxparser` library's TypeScript type definitions are incomplete — they declare `distance` without the `cumul` array property. `as any` is an escape hatch that tells TypeScript "stop type-checking this expression." It's the equivalent of an unchecked cast in Java. Necessary here because we can't change a third-party library's types without extra tooling.

---

## External API Service: `src/services/weatherService.ts`

```ts
export const fetchWeatherForPoint = async (
  lat: number, lon: number, timestamp: number
): Promise<WeatherData> => { ... };
```

**TypeScript concept — `Promise<T>`:** The return type of every `async` function. `Promise<WeatherData>` is equivalent to `CompletableFuture<WeatherData>` in Java.

The function calls Open-Meteo's free forecast API, which returns 48 hours of hourly data for a given latitude/longitude. It finds the index matching the expected arrival hour and extracts the relevant fields.

```ts
const timeIndex = hourly.time.findIndex((t: string) => t === hourIso.slice(0, 16));
```

**TypeScript concept — arrow functions (`(t: string) => t === hourIso`):** These are Java's lambdas. `(param) => expression` is equivalent to `param -> expression` in Java. `findIndex` is like `IntStream.range(...).filter(...).findFirst()` — it returns the position of the first matching element, or `-1` if none.

When the API fails or the exact hour is missing, the module falls back to a synthetic model:

```ts
temp: 20 + Math.sin((hour - 6) * Math.PI / 12) * 5,
```

This produces a plausible-looking daily temperature curve (cool at night, warmer midday) without a real data source.

---

## Map Component: `src/components/MapComponent.tsx`

```tsx
const MapComponent: React.FC<MapComponentProps> = ({ route, weatherPoints, hoveredIndex }) => {
```

**TypeScript concept — destructuring in function parameters:** Instead of receiving a single `props` object and accessing `props.route`, `props.weatherPoints`, etc., you destructure it directly in the parameter list. In Java this would be: `public void render(RouteData route, List<WeatherData> weatherPoints, Integer hoveredIndex)`.

`React.FC<MapComponentProps>` is a generic type meaning "a React Function Component whose props conform to `MapComponentProps`."

### Why the manual icon fix (lines 8–25)?

Vite (the build tool) applies content-hashing to asset filenames for cache-busting, which breaks Leaflet's internal image path resolution. The fix explicitly loads the image files through Vite's asset pipeline and passes them to Leaflet's `L.icon()` factory, bypassing Leaflet's broken default resolution. This is a well-known Vite + Leaflet compatibility issue.

### `hoveredIndex` cross-component communication

When the user hovers over the timeline chart, `App.tsx` stores the hovered index in state and passes it down as a prop to both `MapComponent` and `WeatherTimeline`. The map uses it to enlarge the corresponding marker:

```tsx
icon={idx === hoveredIndex ? HighlightedIcon : DefaultIcon}
```

This is React's unidirectional data flow: state lives at the top (`App`), children receive it as props and emit events upward via callbacks.

---

## Chart Component: `src/components/WeatherTimeline.tsx`

```tsx
interface WeatherTimelineProps {
  weatherPoints: any[];
  onHoverIndex: (index: number | null) => void;
}
```

`onHoverIndex` is a callback prop — the parent passes a function down, and the child calls it when something happens. This is the same pattern as a Java `Consumer<Integer>` listener.

The chart uses **Recharts**, a React charting library. The key architectural decision is the dual Y-axis:

```tsx
<YAxis yAxisId="elevation" ... />
<YAxis yAxisId="temp" orientation="right" ... />

<Area yAxisId="elevation" dataKey="elevation" ... />
<Line  yAxisId="temp"     dataKey="temp" ... />
```

Without this, elevation (which can be hundreds of meters) dominates the scale, flattening temperature changes (a few degrees) into a flat line. Each axis scales independently, making both signals readable.

**TypeScript concept — function type in interface (`(index: number | null) => void`):** This declares a field whose value must be a function taking a `number | null` and returning nothing. In Java: `Consumer<Integer> onHoverIndex` (where `null` would be a sentinel value).

---

## Tests: `tests/app.spec.ts`

Playwright drives a real browser against the running dev server. There are no mocks — it tests the actual rendered UI.

```ts
test('can upload GPX and see route details', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();
});
```

**TypeScript concept — destructuring in function parameters (again):** `{ page }` extracts the `page` property from the fixture object Playwright passes to each test. It's shorthand for `(fixtures) => { const page = fixtures.page; ... }`.

The tests are intentionally thin — they verify that the UI renders the expected elements, not internal logic. The parsing and weather-fetching logic is indirectly exercised by uploading a real GPX file and asserting the result.

---

## Build Tooling

| Tool | Java Equivalent | Role |
|---|---|---|
| **Vite** | Maven / Gradle | Bundles source files, starts dev server, produces `dist/` |
| **TypeScript** | `javac` | Type-checks and transpiles `.ts`/`.tsx` → JavaScript |
| **ESLint** | Checkstyle | Static analysis and style enforcement |
| **Playwright** | Selenium / JUnit | End-to-end browser tests |

`npm run dev` starts the Vite dev server with hot-module replacement — edits to source files reflect in the browser instantly without a full reload. `npm run build` runs `tsc` first (type-check only, no output) then Vite bundles everything into `dist/`.

---

## Data Flow Summary

```
User uploads GPX
  → handleFileUpload (App.tsx)
    → parseGPX (gpxParser.ts)         returns RouteData
    → setRoute(parsedRoute)            triggers useEffect
      → updateWeather(...)
        → fetchWeatherForPoint × 11    parallel Promise.all calls
        → setWeatherPoints(results)    triggers re-render
          → MapComponent              draws polyline + 11 markers
          → WeatherTimeline           draws elevation + temperature chart

User changes date or speed
  → setStartTime / setAvgSpeed        triggers same useEffect chain above

User hovers chart
  → onHoverIndex(idx)                 setHoveredIndex in App.tsx
    → MapComponent re-renders         enlarge marker at that index
```
