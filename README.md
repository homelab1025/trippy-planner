# Trippy Planner

A route weather planner for cyclists and hikers. Upload a GPX file, set your start time and average speed, and see what the weather will be like at each point along your route.

## Features

- **GPX route loading** — upload any GPX track file to visualise your route
- **Interactive map** — the full route is drawn on a map with weather markers at evenly-spaced sample points showing temperature, precipitation, wind speed, and weather condition
- **Elevation + temperature timeline** — a combined chart shows the elevation profile overlaid with interpolated temperature across the route
- **Route stats** — distance, elevation gain, and number of track points are shown after loading a file
- **Configurable ride parameters** — set your average speed (km/h) and planned start date/time to calculate when you'll reach each point
- **Real weather data** — uses the Open-Meteo free API (no API key required); samples 11 evenly-spaced points along the route and fetches hourly forecasts for each, based on your calculated arrival time
- **7-day forecast window** — the date picker is capped at today + 7 days, matching Open-Meteo's forecast horizon

## TODO

- **Deduplicate Open-Meteo requests for nearby points.** Each weather sample point fires a separate API call. Open-Meteo returns the full hourly forecast for a location, so two sample points that are geographically close could share the same response. Implement a cache keyed on a rounded lat/lng grid (e.g. 0.1° resolution) and reuse the cached response instead of making a duplicate request.

- **Downsample elevation chart points.** For routes with many track points (e.g. 5,000+), the chart renders far more points than are visually distinguishable. Apply LTTB (Largest Triangle Three Buckets) downsampling to the chart data to cap the rendered point count (~500) while preserving peaks and troughs.
