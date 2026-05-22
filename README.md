# Trippy Planner

A route weather planner for cyclists and hikers. Upload a GPX file, set your start time and average speed, and see what the weather will be like at each point along your route.

## Features

- **GPX route loading** — upload any GPX track file to visualise your route
- **Interactive map** — the full route is drawn on a map with weather markers at evenly-spaced sample points showing temperature, precipitation, wind speed, and weather condition
- **Route stats** — distance, elevation gain, and number of track points are shown after loading a file
- **Configurable ride parameters** — set your average speed (km/h) and planned start date/time to calculate when you'll reach each point
- **Real weather data** — uses the Open-Meteo free API (no API key required); samples 11 evenly-spaced points along the route and fetches hourly forecasts for each, based on your calculated arrival time
- **7-day forecast window** — the date picker is capped at today + 7 days, matching Open-Meteo's forecast horizon

### Timeline

- a combined chart shows the elevation profile overlaid with interpolated temperature across the route
- the X axis shows the time
- when hovering over the timeline, a tooltip is shown that contains the km, elevation, temperature and time

## TODO

- **Show precipitation on map marker popups.** `precipProb` is already fetched from Open-Meteo and stored in `WeatherData`, but the popup in `MapComponent.tsx` only renders temp, condition, and wind speed. Add precipitation probability to the popup.

- **Deduplicate Open-Meteo requests for nearby points.** Each weather sample point fires a separate API call. Open-Meteo returns the full hourly forecast for a location, so two sample points that are geographically close could share the same response. Implement a cache keyed on a rounded lat/lng grid (e.g. 0.1° resolution) and reuse the cached response instead of making a duplicate request.

- **Decimate the map polyline with Douglas-Peucker.** The `<Polyline>` in `MapComponent.tsx` receives every raw route point without thinning, which makes Leaflet slow on large tracks. Apply Douglas-Peucker at parse time (or inside the Web Worker) to produce a `displayPoints` array, and memoize `positions` with `useMemo` in `MapComponent`.

- **Debounce weather refetch on input changes.** Changing `avgSpeed` or `startTime` immediately triggers 11 parallel API calls per keystroke. Add a ~500ms debounce to the `useEffect` in `App.tsx`.

- **Cancel in-flight weather requests when inputs change.** Stale responses can race and overwrite newer results. Pass an `AbortSignal` through `weatherService.ts` and abort the previous batch whenever a new fetch starts.

- **Avoid full-array allocation in `WeatherTimeline` before LTTB.** The `useMemo` builds a 50k-element array from `route.points` before downsampling. If decimation is done at parse time (see Douglas-Peucker item above), pass the pre-decimated array to the timeline instead.

- **Memoize `positions` in `MapComponent`.** The `positions` array is recreated on every render even when `route` hasn't changed. Wrap with `useMemo`.

## Done

- **Move GPX parsing to a Web Worker.** `parseGPX` runs synchronously on the main thread — large GPX files (50k+ points, common on long rides) freeze the UI during upload. Post the raw XML string to a worker and return `RouteData` to the main thread.

- **Downsample elevation chart points.** LTTB (Largest Triangle Three Buckets) downsampling applied to chart data; target point count scales with the rendered chart width (1 point per CSS pixel) so rendering is efficient at any screen size. Weather sample points are always preserved through downsampling.
