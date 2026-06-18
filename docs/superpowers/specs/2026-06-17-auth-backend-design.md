# Auth, Backend API & Route Persistence — Design Spec

**Date:** 2026-06-17
**Issue:** #37
**Proposal:** E (magic link + optional public route sharing)

## Context

Trippy Planner is currently a pure frontend SPA: a Vite/React/TypeScript app served by nginx with no server-side code. All state is ephemeral — closing the tab loses everything.

This spec introduces:
- A Java Spring Boot backend API (native binary, K8s-deployed)
- PostgreSQL persistence for users and routes
- Magic-link authentication (passwordless, email-based)
- A personal route library ("My routes")
- Optional public sharing via opaque link

## Security note — session model

The session token IS the magic link. A long-lived token is generated on `POST /api/auth/magic-link`, stored in the database, and emailed to the user as a URL parameter. The frontend stores it in `localStorage` and sends it as a Bearer token on every API call.

**Known tradeoff:** the token is visible in the email link, browser history, and the address bar briefly at landing. This is accepted for simplicity at this stage. The upgrade path is: on first click, exchange the link token for a new session token stored in an `httpOnly` cookie, then invalidate the original. This change requires no data model modifications — only the auth flow changes.

---

## 1. Repository Structure

The repo becomes a monorepo. The Vite app moves into `frontend/`, a new Spring Boot project lives in `backend/`, and the root holds orchestration only.

```
trippy-planner/
├── frontend/                        # existing Vite/React/TS app
│   ├── src/
│   │   ├── api/                     # generated TypeScript Axios client (gitignored)
│   │   └── ...                      # existing app code
│   ├── public/
│   ├── index.html
│   ├── package.json                 # adds openapi-generator-cli as dev dependency
│   ├── vite.config.ts               # adds /api proxy to backend in dev
│   └── Dockerfile
├── backend/                         # new Spring Boot native binary
│   ├── src/
│   │   └── main/
│   │       ├── java/
│   │       │   ├── generated/       # generated Spring interfaces + DTOs (gitignored)
│   │       │   └── impl/            # developer-written implementations
│   │       └── resources/
│   │           ├── application.yml
│   │           └── db/migration/    # Flyway SQL files
│   ├── pom.xml                      # adds openapi-generator-maven-plugin
│   └── Dockerfile
├── openapi.yaml                     # source of truth — edit here, everything else follows
├── k8s/
│   ├── base/
│   │   ├── frontend-deployment.yaml
│   │   ├── frontend-service.yaml
│   │   ├── backend-deployment.yaml
│   │   ├── backend-service.yaml
│   │   ├── backend-secret.yaml
│   │   ├── ingress.yaml
│   │   └── kustomization.yaml
│   └── overlays/prod/
├── docker-compose.yml               # local dev: frontend + backend + postgres
├── Makefile                         # generate, build, dev, test targets
├── CLAUDE.md
└── README.md
```

### OpenAPI code generation

`openapi.yaml` is the single source of truth. Both sides generate code from it at build time; generated artifacts are not committed to git.

- **Backend:** `openapi-generator-maven-plugin` with the `spring` generator produces controller interfaces and model DTOs. Developers implement the interfaces; the compiler enforces the contract.
- **Frontend:** `@openapitools/openapi-generator-cli` with the `typescript-axios` generator produces a typed Axios client. The frontend imports and calls it directly.

`make generate` runs both generators. It must be run before `make build` on a clean checkout.

---

## 2. Data Model

All migrations are raw SQL in `backend/src/main/resources/db/migration/`, managed by Flyway. No schema generation from Java classes.

```sql
-- V1__create_users.sql
CREATE TABLE users (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- V2__create_sessions.sql
-- The session token IS the magic link (see security note above).
-- Token is a 20-character random URL-safe string generated with SecureRandom.
CREATE TABLE sessions (
  token      TEXT        PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- V3__create_routes.sql
-- gpx_content stores the raw GPX XML as uploaded. Immutable after creation.
-- share_token is NULL when private; set to a UUID string when public.
-- Making a route private NULLs share_token — the old link 404s immediately.
CREATE TABLE routes (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT         NOT NULL,
  gpx_content   TEXT         NOT NULL,
  avg_speed_kmh NUMERIC(5,2) NOT NULL,
  start_time    TIMESTAMPTZ  NOT NULL,
  is_public     BOOLEAN      NOT NULL DEFAULT false,
  share_token   TEXT         UNIQUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- V4__indexes.sql
CREATE INDEX ON sessions(user_id);
CREATE INDEX ON sessions(expires_at);
CREATE INDEX ON routes(user_id);
```

### Design decisions

- `users.id` is `BIGINT GENERATED ALWAYS AS IDENTITY` — it is never exposed in URLs or API responses, so UUID offers no benefit and costs index performance.
- `routes.id` is `UUID` — it appears in API paths (`GET /api/routes/{id}`) where an enumerable integer would leak existence to unauthorized callers.
- GPX content is stored as `TEXT` in the database. Typical GPX files are 100 KB–2 MB; no object storage dependency is needed.
- GPX content is immutable after save. `PUT /api/routes/{id}` does not accept `gpx_content`. To change the track, delete and re-create.
- `share_token` is `NULL` when private. Setting a route to private NULLs the token — no separate revocation step needed.

---

## 3. API Surface

All endpoints are prefixed `/api`. Protected endpoints require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/magic-link` | — | Accepts `{email}`. Creates a session token, emails the magic link. Always returns `204` — never reveals whether the email exists. |
| `GET` | `/api/auth/me` | required | Returns `{id, email}`. Used by the frontend to validate a stored token on app load. |
| `DELETE` | `/api/auth/session` | required | Deletes the current session row. Signs out the current device only. |

### Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/routes` | required | Lists the user's routes: `id`, `name`, `avg_speed_kmh`, `start_time`, `is_public`, `created_at`. GPX content excluded. |
| `POST` | `/api/routes` | required | Creates a route. Body: `{name, gpx_content, avg_speed_kmh, start_time}`. Returns full route. |
| `GET` | `/api/routes/{id}` | required | Returns full route including `gpx_content`. Returns `403` if the route belongs to another user. |
| `PUT` | `/api/routes/{id}` | required | Updates `name`, `avg_speed_kmh`, or `start_time`. |
| `DELETE` | `/api/routes/{id}` | required | Deletes the route. If public, the share link 404s immediately. |
| `POST` | `/api/routes/{id}/share` | required | Sets `is_public = true`, generates `share_token`. Returns `{share_token}`. Idempotent — returns existing token if already public. The frontend constructs the full share URL as `{APP_BASE_URL}/share/{share_token}`. |
| `DELETE` | `/api/routes/{id}/share` | required | Sets `is_public = false`, nulls `share_token`. |

### Public sharing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/share/{share_token}` | — | Returns full route including `gpx_content`. Returns `404` if the token does not exist or the route is no longer public. |

---

## 4. Auth Flow

1. User clicks "Save route" in the frontend.
2. If no session token in `localStorage`, the app shows an email input: "Enter your email to save this route."
3. Frontend calls `POST /api/auth/magic-link` with `{email}`.
4. Backend:
   - Finds or creates a `users` row for that email.
   - Generates a 20-character URL-safe session token using `SecureRandom`.
   - Inserts into `sessions` with `expires_at = now() + SESSION_EXPIRY_MINUTES`.
   - Sends an email via Resend with link: `{APP_BASE_URL}/auth?token=<token>`.
   - Returns `204`.
5. Frontend shows: "Check your email for a sign-in link."
6. User clicks the link in the email. The browser opens `{APP_BASE_URL}/auth?token=<token>`.
7. On app load, if `window.location.search` contains a `token` parameter:
   - Store the token in `localStorage`.
   - Strip the token from the URL using `history.replaceState`.
   - Call `GET /api/auth/me` to confirm validity and load the user's email.
   - Proceed as authenticated.

**Multiple sessions:** each `POST /api/auth/magic-link` call creates a new session row. Multiple devices can be active simultaneously. Sign-out on one device does not affect others.

**Expired session:** `GET /api/auth/me` returns `401`. The frontend clears `localStorage` and shows the unauthenticated state.

---

## 5. Frontend Changes

### Session module (`src/auth.ts`)

Thin module: `getToken()`, `setToken(token)`, `clearToken()` — reads and writes `localStorage`. The generated Axios client is initialised once with a request interceptor that calls `getToken()` and attaches `Authorization: Bearer <token>` to every request.

### Token landing (`src/main.tsx` or `src/App.tsx`)

On app mount, before rendering, check for `?token=` in the URL. If present: call `setToken`, call `history.replaceState` to clean the URL, then proceed. No separate route or page needed.

### New UI surfaces

**Header** — sign-in button when unauthenticated; user email + sign-out link when authenticated.

**"Save route" button** — appears in the sidebar after a GPX is loaded. If authenticated, calls `POST /api/routes` directly. If not, shows the email input flow.

**"My routes" panel** — collapsible sidebar section. Calls `GET /api/routes` on open. Clicking a route calls `GET /api/routes/{id}`, parses the returned GPX, and loads it as if the user had uploaded the file.

**Share toggle** — visible on a loaded route that the user owns. On enable, calls `POST /api/routes/{id}/share`, receives `{share_token}`, and displays a copyable link constructed as `{APP_BASE_URL}/share/{share_token}`. On disable, calls `DELETE /api/routes/{id}/share`.

**Public route view** — if the URL path matches `/share/{token}` on app load, calls `GET /api/share/{token}` and loads the route. The sidebar shows "Viewing a shared route" with no save or share controls. nginx's existing `try_files` directive already serves `index.html` for this path — no server config change needed.

### No changes to existing logic

GPX parsing, weather fetching, the map, the elevation chart, and all existing sidebar controls are unchanged. The new auth and persistence layer is entirely additive.

---

## 6. Infrastructure

### Local development

`docker-compose.yml` defines three services:

- `postgres` — `postgres:17`, port 5432, named volume for persistence.
- `backend` — Spring Boot on port 8080. `SPRING_DATASOURCE_URL` points to the compose postgres. `RESEND_API_KEY` and other secrets loaded from a local `.env` file (gitignored).
- `frontend` — Vite dev server on port 5173. Vite's proxy config forwards `/api/*` to `http://backend:8080`, eliminating CORS in local dev.

### Dockerfiles

`frontend/Dockerfile` — two-stage: Node build → nginx. Same as today, paths updated for `frontend/` subdirectory.

`backend/Dockerfile` — two-stage: GraalVM `native-compile` → distroless base image. No JRE at runtime; image is ~50 MB.

### Kubernetes

PostgreSQL is provided by the cluster — no StatefulSet. The ingress routes `/api/*` to the backend service and `/*` to the frontend service. No CORS configuration needed in production.

```
k8s/base/
├── frontend-deployment.yaml
├── frontend-service.yaml
├── backend-deployment.yaml    # 1 replica, native binary
├── backend-service.yaml       # ClusterIP, port 8080
├── backend-secret.yaml        # env vars below
├── ingress.yaml               # /api/* → backend, /* → frontend
└── kustomization.yaml
```

### Backend environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL | — |
| `SPRING_DATASOURCE_USERNAME` | DB user | — |
| `SPRING_DATASOURCE_PASSWORD` | DB password | — |
| `RESEND_API_KEY` | Resend email API key | — |
| `APP_BASE_URL` | Base URL for magic links (`https://trippy.app`) | — |
| `SESSION_EXPIRY_MINUTES` | Session token lifetime | `43200` (30 days) |

---

## 7. Out of Scope

- Route sharing with fine-grained permissions (collaborators, view-only links with expiry)
- OAuth / social login (Google, GitHub) — possible future upgrade alongside magic link
- Upgrade to secure session exchange (one-time link token → `httpOnly` cookie session) — documented above, deferred
- Email deliverability fallback (resend link, alternative login) — deferred
- Public user profiles or route discovery
- Route versioning or edit history
