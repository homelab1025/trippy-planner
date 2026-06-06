# Weather Chart Relayout Design

**Date:** 2026-06-06
**Status:** Approved

## Problem

The temperature + wind chart currently lives in the sidebar "Weather" accordion as a full-height chart with axes. The sidebar is a poor fit — it competes with ride controls and is visually disconnected from the elevation and precipitation charts in the main card.

## Goal

Move the temp + wind chart into the main card, between the elevation and precipitation strips. Remove the sidebar Weather accordion entirely.

## Design

### Layout — main card `elevation-row`

Stacking order after the change:

| Strip | Height | Props |
|---|---|---|
| `ElevationChart` | 300 px | unchanged |
| `WeatherLineChart` (temp + wind) | 80 px | `hideAxes`, `border-t border-base-200` divider above |
| `WeatherLineChart` (precip prob + amount) | 80 px | `hideAxes`, `border-t border-base-200` divider above (existing) |

The two weather strips are visually separated from each other and from the elevation chart by the same thin `border-t` dividers already in use.

### Sidebar change

Remove the entire "Weather" `collapse` block from the sidebar in `App.tsx`. No accordion placeholder is left — the section simply disappears.

### Data / prop changes

None. `tempWindData`, `TEMP_LINE`, `WIND_LINE`, `PROB_LINE`, `AMOUNT_LINE` consts all stay in `App.tsx`. `WeatherLineChart` component is unchanged — it already accepts `hideAxes`.

## Files touched

- `src/App.tsx` — remove sidebar Weather accordion; insert temp+wind `WeatherLineChart` strip into main card between ElevationChart and precip strip

## Out of scope

- No changes to `WeatherLineChart.tsx`
- No changes to chart heights other than the new strip matching the existing 80 px precip strip
- No extraction into a shared `ChartStack` component
