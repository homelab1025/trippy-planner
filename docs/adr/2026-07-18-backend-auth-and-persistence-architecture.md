# ADR: Backend service, magic-link auth, and route persistence architecture

**Date:** 2026-07-18
**Status:** Accepted
**Related:** [FDR: Accounts, saved routes, and public sharing](../fdr/2026-07-18-accounts-saved-routes-and-sharing.md), [design spec](../superpowers/specs/2026-06-17-auth-backend-design.md), [k8s DB secret refactor spec](../superpowers/specs/2026-07-11-k8s-db-secret-refactor-design.md), [e2e auth mock spec](../superpowers/specs/2026-07-17-e2e-auth-mock-design.md)

## Context

Trippy Planner was a pure frontend SPA with no server-side code — closing
the tab lost everything, and nothing could be shared or revisited across
devices (issue #37). Adding persistence and sharing required picking an
auth model, a backend stack, and a way to keep two independently-generated
clients (frontend, backend) from drifting apart.

## Decision

- **Monorepo split**: the existing Vite app moved into `frontend/`; a new
  Java Spring Boot service lives in `backend/`; the root holds orchestration
  only (`docker-compose.yml`, `Makefile`, `openapi.yaml`, `k8s/`).
- **`openapi.yaml` as single source of truth**: `openapi-generator-maven-plugin`
  generates Spring controller interfaces + model DTOs for the backend;
  `@openapitools/openapi-generator-cli` generates a typed Axios client for
  the frontend. Neither generated tree is committed to git — `make generate`
  regenerates both from the spec before a clean build.
- **Magic-link auth where the session token IS the link token**: `POST
  /api/auth/magic-link` generates a 20-character `SecureRandom` token,
  stores it in a `sessions` row, and emails it as a URL parameter; the
  frontend stores it in `localStorage` and sends it as `Authorization:
  Bearer <token>` on every call via `SecurityFilter`. No passwords, no
  separate exchange step.
- **Postgres + Flyway** for persistence, with hand-written SQL migrations
  (`V1__create_users.sql` … `V4__indexes.sql`) rather than schema generation
  from Java classes.
- **Data model**: `users.id` is `BIGINT IDENTITY` (never exposed in URLs, so
  no enumeration risk); `routes.id` is `UUID` (it does appear in URLs, so a
  guessable integer would leak existence to unauthorized callers);
  `gpx_content` is immutable `TEXT` after creation — changing the track
  means delete-and-recreate, not update; `routes.share_token` is `NULL`
  when private, so making a route private revokes the link with no separate
  revocation step.
- **Deployment**: Docker images for both services pushed to GHCR, deployed
  to k8s via kustomize overlays, secrets consolidated under one
  `trippy-secret` (see the linked k8s DB secret refactor spec).

## Alternatives considered

- **`httpOnly`-cookie session, exchanged from a one-time link token** —
  the design spec documents this as the intended upgrade path and
  explicitly defers it: the magic-link-as-session-token approach means the
  token is visible in the email, browser history, and address bar briefly
  at landing, accepted for simplicity at this stage. The data model needs
  no changes to make this upgrade later — only the auth flow.
- **OAuth / social login** — deferred per the design spec as a possible
  future addition alongside, not instead of, magic link.
- **GraalVM native binary backend image** (the design spec's original
  plan) — implemented, then reverted during the same PR ("remove native
  support and just use normal jvm in container") in favor of a plain JVM
  fat-jar image; matches the backend description in CLAUDE.md today.

## Consequences

- Every API change now goes through `openapi.yaml` first — both generated
  clients follow from it, so the two sides can't drift silently, but it
  also means a schema change always touches three places (the spec, and
  whatever hand-written code adapts to the newly-generated interfaces on
  each side).
- Because the magic link token is the long-lived session token, anyone who
  can read the email (or intercepts it before landing) has full account
  access until the session expires — this is a known, accepted, and
  explicitly documented tradeoff, not an oversight.
- `gpx_content` immutability means "editing a route's track" isn't a
  supported operation anywhere in the stack — only name/speed/start-time
  can be updated in place.
- E2E tests can't drive a real magic-link email round-trip, so a
  test-only auth mock path was added alongside this work (see the linked
  e2e auth mock spec) — a permanent addition to the test surface, not a
  temporary scaffold.
