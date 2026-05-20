# Separate Start Date and Time Inputs & Remove Optimal Start Time

This plan details the changes to separate the date and time selectors in the sidebar, ensure that changing either input automatically refreshes the forecast, and remove the "Optimal Start Time" feature.

## User Review Required

> [!NOTE]
> We will restrict the date picker from today up to 7 days in the future to ensure Open-Meteo has forecast data available.

## Proposed Changes

### [Component] App
#### [MODIFY] [App.tsx](file:///Users/florin/oven/trippy-planner/src/App.tsx)
- Remove `findOptimalStartTime` import.
- Modify the inputs in the sidebar:
  - Replace the single `datetime-local` input with two inputs side-by-side: `<input type="date">` and `<input type="time">`.
  - Handle conversion between the unified `startTime` (Date state) and the separate string representations (`YYYY-MM-DD` and `HH:MM`).
  - Add `min` (today) and `max` (today + 7 days) attributes to the date input.
- Remove the "Find Optimal Start Time" button and its associated loading/click handlers.

### [Component] Weather Logic
#### [MODIFY] [weatherService.ts](file:///Users/florin/oven/trippy-planner/src/services/weatherService.ts)
- Remove `findOptimalStartTime` function definition entirely.

### [Component] E2E Tests
#### [MODIFY] [app.spec.ts](file:///Users/florin/oven/trippy-planner/tests/app.spec.ts)
- Verify there is no "Optimal Start Time" button.
- Ensure date and time inputs exist.

### [Component] Styles
#### [MODIFY] [App.css](file:///Users/florin/oven/trippy-planner/src/App.css)
- Add CSS styles to place the date and time inputs side-by-side.
- Remove styling related to the optimal start time button.

## Verification Plan

### Automated Tests
- Run `npm run build` to verify there are no TypeScript issues.
- Run `npx playwright test` to verify the tests pass.

### Manual Verification
- Upload a GPX route.
- Change the date input and verify weather updates.
- Change the time input and verify weather updates.
