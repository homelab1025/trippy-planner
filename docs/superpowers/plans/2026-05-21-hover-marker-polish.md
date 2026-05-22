# Hover Marker Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain orange hover dot on the map with a glow + white-bordered dot for better visual polish.

**Architecture:** Two stacked `CircleMarker` components replace the current single one inside `MapComponent.tsx`. The first (rendered behind) is a large low-opacity circle that creates the glow; the second (rendered on top) is the crisp white-bordered core dot. No animation, no new dependencies.

**Tech Stack:** react-leaflet `CircleMarker`, TypeScript

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/components/MapComponent.tsx:49-55` | Replace single hover CircleMarker with two stacked markers |

---

### Task 1: Polish the hover marker

**Files:**
- Modify: `src/components/MapComponent.tsx:49-55`

- [ ] **Step 1: Update the Playwright test to assert both circles exist**

The existing E2E test checks `path[fill="#FF6B00"]` is not absent — that still passes with two circles. But add an assertion that confirms the glow circle is also present so a regression (dropping one of the two) would be caught.

Open `tests/app.spec.ts` and update the `hover over timeline shows orange marker on map` test. Replace:

```ts
test('hover over timeline shows orange marker on map', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane svg path')).toBeVisible();
  const timeline = page.locator('.timeline-container');
  await timeline.hover({ position: { x: 200, y: 100 } });
  // Leaflet renders CircleMarker as SVG <path> elements (arc commands), not <circle>
  await expect(page.locator('.leaflet-overlay-pane svg path[fill="#FF6B00"]')).toBeVisible();
});
```

With:

```ts
test('hover over timeline shows polished orange marker on map', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane svg path')).toBeVisible();
  const timeline = page.locator('.timeline-container');
  await timeline.hover({ position: { x: 200, y: 100 } });
  // Two stacked CircleMarkers: glow ring + core dot, both fill="#FF6B00"
  await expect(page.locator('.leaflet-overlay-pane svg path[fill="#FF6B00"]')).toHaveCount(2);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx playwright test tests/app.spec.ts --grep "polished orange marker"
```

Expected: **FAIL** — currently only 1 orange path exists, test expects 2.

- [ ] **Step 3: Update `MapComponent.tsx`**

In `src/components/MapComponent.tsx`, replace lines 49–55:

```tsx
      {hoveredPoint && (
        <CircleMarker
          center={[hoveredPoint.lat, hoveredPoint.lng]}
          radius={9}
          pathOptions={{ fillColor: '#FF6B00', fillOpacity: 1, stroke: false }}
        />
      )}
```

With:

```tsx
      {hoveredPoint && (<>
        <CircleMarker
          center={[hoveredPoint.lat, hoveredPoint.lng]}
          radius={24}
          pathOptions={{ fillColor: '#FF6B00', fillOpacity: 0.12, stroke: false }}
        />
        <CircleMarker
          center={[hoveredPoint.lat, hoveredPoint.lng]}
          radius={10}
          pathOptions={{ fillColor: '#FF6B00', fillOpacity: 1, stroke: true, color: 'white', weight: 2.5 }}
        />
      </>)}
```

- [ ] **Step 4: Run the updated test to confirm it passes**

```bash
npx playwright test tests/app.spec.ts --grep "polished orange marker"
```

Expected: **PASS**

- [ ] **Step 5: Run the full E2E suite to check for regressions**

```bash
npx playwright test
```

Expected: all tests pass. Note: the `no pin markers on map` test checks `leaflet-marker-icon` count (DOM markers), not SVG paths — unaffected by this change.

- [ ] **Step 6: Commit**

```bash
git add src/components/MapComponent.tsx tests/app.spec.ts
git commit -m "feat: polish hover marker with glow ring and white border"
```
