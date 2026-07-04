# Build Pipeline — Planning Notes

## Test execution order

**Tests MUST run BEFORE building the container image.**

The backend Dockerfile runs `mvnw package -DskipTests` — tests are skipped in the Docker build step and must be executed as a separate CI job before the image is built.

### Build pipeline structure (to be implemented)

When creating the build pipeline, the workflow should follow this order:

1. **Checkout** — clone the repository
2. **Run backend unit tests** — `cd backend && ./mvnw test -q`
3. **Run frontend unit tests** — `cd frontend && npx vitest run`
4. **Run frontend E2E tests** — `cd frontend && npx playwright test`
5. **Build & push Docker images** — only after all tests pass

The existing `.github/workflows/build.yml` already has the test jobs (`unit-test`, `e2e-test`) running in parallel before the `build` job, which depends on both. The `build` job only triggers on push to `master`. This structure is correct — no changes needed to the workflow ordering.

### Files to modify when building the pipeline

- `.github/workflows/build.yml` — add backend unit test step (currently only frontend tests are run)
- `backend/Dockerfile` — already updated with `-DskipTests`
- `Makefile` — the `build` target uses `docker build` which no longer runs tests
