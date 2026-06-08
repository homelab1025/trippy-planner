---
name: sidebar-accordion
description: Refactor the left sidebar into a single-open vertical accordion with three panels — Ride Details, Weather, Tech Details — removing the sidebar-bottom grid area
metadata:
  type: project
---

# Sidebar Vertical Accordion

## Goal

Replace the current left-column layout (two separate collapsibles plus a pinned bottom panel) with a single-open vertical accordion containing three named panels.

## State change

Remove:
```ts
const [rideDetailsOpen, setRideDetailsOpen] = useState(true);
const [techDetailsOpen, setTechDetailsOpen] = useState(false);
```

Add:
```ts
const [activePanel, setActivePanel] = useState<'ride' | 'weather' | 'tech' | null>('ride');
```

Clicking an open panel's header sets `activePanel` to `null` (collapse). Clicking a closed panel sets it to that panel's key (single-open: the previously open panel closes automatically).

## Layout change

### Remove `sidebar-bottom`

The `sidebar-bottom` div exists solely to pin Tech Details to the bottom via CSS grid row 2. Delete the div and move its contents into `sidebar-scrollable`.

### CSS grid simplification

`main-content` currently uses `grid-template-rows: 1fr auto` to accommodate the bottom-pinned panel. Remove that — the grid only needs one row now, so `grid-template-rows` can be dropped (defaults to `1fr`). `display-area` row span simplifies from `grid-row: 1 / 3` to `grid-row: 1`.

Delete `.sidebar-bottom` CSS rule entirely.

## Panels

### Ride Details (default open)

Content unchanged: avg speed input, start date + time inputs, Clock/Elapsed toggle.

### Weather

When `route` is loaded: render the two `WeatherLineChart` panels (temp/wind, precip/prob) stacked, with their existing `tempwind-container` / `precip-container` CSS classes and `height: var(--chart-sidebar-height)`.

When `route` is `null`: render a centred placeholder line — "Load a route to see weather" — styled consistently with other empty states (e.g. `color: var(--text-secondary)`).

### Tech Details

Content unchanged: DP epsilon + max gap inputs, parse stats grid, weather provider selector, debug toggle, build info. Moves from `sidebar-bottom` into `sidebar-scrollable`.

## README TODO

Add to README.md:

> **TODO:** Replace hand-rolled UI components (accordion, inputs, buttons) with a React component library (e.g. shadcn/ui or Radix UI).

## Out of scope

- No animation/transition on panel open/close
- No changes to right-column layout (map, elevation chart, hover pane)
- No changes to chart internals or weather data flow
