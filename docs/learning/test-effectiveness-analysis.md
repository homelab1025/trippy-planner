# Analyzing Test Effectiveness (Frontend + Backend)

A discussion of how to measure whether the tests we have are actually good, not just numerous — moving from the cheapest/weakest signal to the strongest/most expensive, grounded in what's already set up in this repo.

## 1. Coverage — necessary but weak on its own

Already generated on both sides (`test:coverage` in frontend, JaCoCo in backend, published via `coverage.yml`), but a few things stand out:

- **JaCoCo only runs the `report` goal, not `check`** — nothing in `pom.xml` fails the build below a threshold. So coverage is *visible* but not *enforced*. Same on the frontend side: the coverage workflow publishes to Pages on push to `master`, but doesn't gate PRs.
- Coverage answers "was this line executed," not "would a bug here be caught." A line can be 100% covered by an assertion-free test. Worth spot-checking: do the tests in files like `RoutesControllerTest.java` or `apiClient.test.ts` actually assert on behavior, or mostly just "doesn't throw"?
- Line/branch coverage on `App.tsx` specifically matters more than average here, since per the project architecture it owns almost all app state via one large component with cascading `useEffect`s — that's exactly the kind of file where partial coverage hides real risk (an effect with 4 branches, only 1 path tested).

Coverage is a good floor-setting tool (catch totally untested modules) but a bad ceiling metric (100% coverage tells you little about quality).

## 2. Mutation testing — already present, but scoped narrowly

Stryker is configured (`stryker.conf.json`), but its `mutate` glob is `src/utils/**`, `src/services/**`, `src/workers/**` — explicitly excluding `src/components/**`, `App.tsx`, and `src/hooks/**`. That means the ~28 vitest files include a lot of component tests (`ElevationChart.test.tsx`, `MyRoutesPanel.test.tsx`, `CheckpointTimeEditor.test.tsx`, etc.) whose *actual defect-catching power* is never measured — only the pure-function layer is mutation-tested.

This is a legitimate scoping choice (component mutation testing is slower and noisier with React), but it means: if someone asks "how good are our component tests," coverage % is currently the only answer, and that's the weak metric from §1. A mutation score on `utils`/`services`/`workers` (GPX parsing, weather sampling, climb detection, Douglas-Peucker decimation) is the most trustworthy quality signal currently available — that's the highest-value place to look first for "which tests are actually load-bearing."

There's no equivalent for backend Java (no PIT/pitest in `pom.xml`) — that's a real gap if the same signal is wanted for `RoutesController`, `ShareController`, auth flows.

## 3. Test pyramid shape / where the weight sits

Rough shape: ~28 vitest unit/component files, 3 Playwright E2E specs, 15 backend JUnit files (several are repository/integration tests against Postgres, not pure unit). Worth asking:

- Are the 3 E2E specs (`app.spec.ts`, `my-routes.spec.ts`, `local-route-persistence.spec.ts`) covering the *cross-cutting* flows that unit tests structurally can't (GPX upload → worker → weather fetch → chart render, auth → save → reload)? E2E effectiveness isn't about count, it's about whether each one earns its slowness by testing something no unit test can.
- Backend has both `*RepositoryTest` (real DB round-trip) and `*ControllerTest` (presumably MockMvc/unit-ish) — that split is good practice, but worth checking whether controller tests mock the service layer so thinly that they're really re-testing the framework.

## 4. CI signal quality — is a red/green actually trustworthy

This matters most for continuous deployment specifically, independent of what the tests check:

- **Flakiness rate**: Playwright against a live dev server is a classic flake source — timing, port reuse, network calls to real Open-Meteo in tests unless mocked. Worth checking whether `openMeteo.test.ts` and the E2E specs hit the network or a fixture/mock. A flaky-but-real-bug-catching test and a flaky-and-useless test look identical in CI logs; you'd want failure-rate-over-time data (rerun history) to tell them apart.
- **Mutation testing in CI**: `test:mutation` exists as an npm script but doesn't appear in any `.github/workflows/*.yml` — so the strongest signal available is currently manual-only, meaning it silently rots as code changes and nobody notices a dropping mutation score.
- **PR-time vs. merge-time feedback**: coverage only runs on push to `master`, so a regression in coverage is discovered *after* merge, not before. That's backwards for a "continuous deployment" goal — the whole point is to catch regressions before they're deployable.

## 5. Contract/boundary testing

Since `openapi.yaml` is the single source of truth generating both the TS client and Spring interfaces, the sharpest-edged bugs (frontend/backend disagreeing on a field name or nullability) are the ones unit tests on either side *can't* see individually. Worth asking whether anything actually exercises frontend-against-real-backend (even just the E2E suite hitting a live `make dev` stack) versus everything being mocked at the API boundary on both sides independently — that's a coverage gap that no coverage percentage will ever reveal, since each side is "fully tested" in isolation.

## Priority order

1. Turn on JaCoCo's `check` goal and wire mutation testing into CI so the strongest signals already built stop being manual-only.
2. Widen or deliberately justify Stryker's scope excluding components.
3. Audit the 3 E2E specs for flake rate and network-mocking.
4. Spot-check assertion quality in a sample of the highest-coverage, never-failing test files (those are the ones most likely to be coverage theater).
