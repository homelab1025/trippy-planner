# E2E auth via real magic-link flow + mocked email service

## Problem

`frontend/tests/helpers/testAuth.ts` authenticates E2E tests by shelling out to
`docker compose exec postgres psql` and inserting a `sessions` row directly. This
bypasses `POST /auth/magic-link` and `ResendEmailService` entirely, so the actual
login flow is never exercised by the E2E suite. It also requires the `postgres`
container to be reachable via `docker compose exec` from the Node test process,
and (separately, pre-existing) the `e2e-test` Make target never actually starts
`postgres`/`backend` itself — see "Pre-existing gaps" below.

## Goal

Replace the direct-DB-insert bypass with the real HTTP flow: call
`POST /auth/magic-link`, retrieve the token the backend would have emailed, and
use it to authenticate the browser session — without calling the real Resend API
from tests.

## Key facts driving the design

- `AuthController.requestMagicLink` (`backend/src/main/java/com/trippyplanner/auth/AuthController.java:38-49`)
  writes the session token to the `sessions` table *before* calling
  `emailService.sendMagicLink(...)`. The email is a side effect, not the source
  of truth — the token already exists in Postgres by the time the HTTP response
  returns.
- `emailService.sendMagicLink(...)` is called synchronously, in the same request
  thread, before the controller returns `204`. Any test-side retrieval of the
  token can happen immediately after the `POST` resolves — no polling needed.
- `frontend/playwright.config.ts:20-24` starts the frontend dev server itself
  (`npm run dev`, port 5173) and proxies `/api` to `localhost:8080`
  (`frontend/vite.config.ts:11`). The E2E suite must not also start the
  `frontend` Docker service, or the two will collide on port 5173.
- No `contributing/styleguide/java.md` existed before this design; one was added
  (Effective-Java-based constraints) and governs the new Java code below —
  notably: prefer interfaces for multi-implementation types (Item 20), minimize
  mutability or final fields (Item 17), `Optional` only as a return type
  (Item 55).

## Design

### Backend

New package `com.trippyplanner.testsupport`, kept separate from `auth` so it's
obvious at a glance which classes exist only for tests and can never activate
outside the `e2e` profile.

- `com.trippyplanner.auth.EmailService` — new interface:
  `void sendMagicLink(String email, String token)`.
- `ResendEmailService implements EmailService`, annotated `@Profile("!e2e")`.
  Behavior unchanged otherwise.
- `com.trippyplanner.testsupport.InMemoryEmailService implements EmailService`,
  `@Service @Profile("e2e")`. Holds a `private final ConcurrentHashMap<String, String>
  tokensByEmail`. `sendMagicLink` does `tokensByEmail.put(email, token)` (last
  write wins per email, no expiry — the E2E suite uses a small fixed set of test
  emails, and each `beforeEach` requests a fresh token). Exposes
  `Optional<String> findToken(String email)`.
- `com.trippyplanner.testsupport.MagicLinkTokenTestController`,
  `@RestController @Profile("e2e")`:
  - `GET /test/magic-link-token?email=...` → `200 { "token": "..." }` (via a
    small `record MagicLinkTokenResponse(String token)`) or `404` if not found.
  - Not part of `openapi.yaml` — it's a test seam, not a product contract, and
    must never be generated into the frontend's Axios client.

No property file changes needed. `resend.api-key`, `app.base-url`,
`spring.datasource.*`, `app.session-expiry-minutes` are read via `@Value` only
inside the constructors of the beans that use them. Since `ResendEmailService`
becomes `@Profile("!e2e")`, Spring never instantiates it when `e2e` is active, so
`resend.api-key` is never looked up — it doesn't matter whether `RESEND_API_KEY`
resolves to a real key or is unset under the `e2e` profile. The whole mechanism
is bean selection via `@Profile`, not property overrides.

### docker-compose e2e overlay

New `docker-compose.e2e.yml` at repo root, additive overlay (Compose merges
`environment:` maps by key):

```yaml
services:
  backend:
    environment:
      SPRING_PROFILES_ACTIVE: e2e
```

Datasource connection details are unchanged from the base stack:
`jdbc:postgresql://postgres:5432/trippy`, user/password `trippy`/`trippy`
(`docker-compose.yml:27-29`), same `postgres` service and named volume
(`postgres_data`) as `make dev`.

**Accepted trade-off:** this design deliberately shares the default Compose
project (and therefore the `postgres_data` volume and `backend`/`postgres`
containers) with `make dev`, rather than running under an isolated project name.
Consequence: running `make e2e-test` while `make dev` is active will recreate
the `backend` container in place with `SPRING_PROFILES_ACTIVE=e2e` (replacing
the developer's dev backend mid-session), and the final `docker compose down`
in the `e2e-test` target will stop the whole shared stack, including the
developer's Postgres. This was flagged during design and knowingly accepted —
documenting it here so it isn't mistaken for an oversight.

### Makefile

`e2e-test` target extended to bring the stack up first and tear it down after,
regardless of test outcome:

```makefile
e2e-test: generate-frontend
e2e-test:
	docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build --wait backend
	cd frontend && npm ci && npx playwright test; \
	status=$$?; \
	docker compose -f docker-compose.yml -f docker-compose.e2e.yml down; \
	exit $$status
```

`up ... backend` (not a bare `up`) names only the `backend` service. Compose
still starts `postgres` automatically via `depends_on`, but deliberately skips
the `frontend` container, avoiding the port-5173 collision described above.

### Pre-existing gaps this design also closes

Today, `make e2e-test` (`Makefile:16-18`) runs `npx playwright test` without
starting `postgres` or `backend` at all, and the `e2e-test` job in
`.github/workflows/build.yml` runs on a `self-hosted` runner with no compose
step either — it's unclear whether that runner has a stack persistently running
as a background service, or whether `my-routes.spec.ts` (added in `59e19ba`,
which already required Postgres via the old `testAuth.ts`) has been silently
relying on that. This design makes `make e2e-test` self-contained, closing that
gap regardless of the runner's prior state.

### Frontend: `testAuth.ts` rewrite

Replaces the `psql`/direct-insert approach with real HTTP calls against the
running e2e-profile backend:

```typescript
const TEST_EMAIL = 'e2e-my-routes@trippy-planner.test';

export async function createAuthenticatedSession(email: string = TEST_EMAIL): Promise<string> {
  await fetch('http://localhost:8080/api/auth/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const res = await fetch(`http://localhost:8080/api/test/magic-link-token?email=${encodeURIComponent(email)}`);
  const { token } = await res.json();
  return token;
}
```

- Becomes `async` (it wasn't before) — `my-routes.spec.ts:30`
  (`const token = createAuthenticatedSession();` inside `beforeEach`) needs an
  `await` added.
- Drops `execSync`, `path`/`fileURLToPath`/`REPO_ROOT` imports, and
  `randomToken()` entirely — none of that is needed anymore since the backend
  now issues the token.
- Talks to `localhost:8080` directly (not through the Vite proxy), since this
  runs in Node outside the browser page context — matches the already-published
  port in `docker-compose.yml:23` (`"8080:8080"`).

## Testing / verification

- Existing backend unit tests (`ResendEmailServiceTest`, `AuthController`-related
  tests) run unaffected: `backend/src/test/resources/application.properties`
  never sets `spring.profiles.active`, so `e2e` is never active there —
  `ResendEmailService` remains the wired bean.
- New unit tests for `InMemoryEmailService` (put/get roundtrip) and
  `MagicLinkTokenTestController` (found/not-found), run under
  `@ActiveProfiles("e2e")`.
- `./mvnw test` (no profile) confirms the `EmailService` interface extraction
  didn't break normal wiring — exactly one `EmailService` bean resolves.
- `make e2e-test` end-to-end is the real proof: brings up `backend`+`postgres`
  with `SPRING_PROFILES_ACTIVE=e2e`, runs the full Playwright suite including
  `my-routes.spec.ts`, tears down after.

## Out of scope

- Asserting on the *content* of the would-be email (subject/link format) — not
  needed per requirements; `InMemoryEmailService` only stores the token.
- Isolating the E2E Compose project from `make dev` — explicitly deferred (see
  accepted trade-off above).
