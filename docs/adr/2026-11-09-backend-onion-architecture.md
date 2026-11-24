# ADR: Backend-level onion architecture

**Date:** 2026-11-09
**Status:** Proposed
**Supersedes:** [Enforce backend module boundaries with ArchUnit](2026-11-09-backend-module-boundaries-archunit.md)
**Related:** [Backend service, magic-link auth, and route persistence architecture](2026-07-18-backend-auth-and-persistence-architecture.md)

## Context

The backend's top-level packages (`auth`, `routes`, `share`, `version`,
`common`) were first given enforced boundaries — each module may only use
another module's `api` sub-package (the module-boundaries ADR). That
enforcement lived in `ModuleArchitectureTest` and added a second layer of
ArchUnit rules on top of a per-module onion.

For a service of ~ten endpoints, nesting a per-module onion *inside* a
module-boundary layer was more ceremony than it was worth. The two
concerns — which modules may talk, and how a module is layered — are two
different axes, and the module matrix had to be re-expressed every time a
ring moved. The generated OpenAPI DTOs (`com.trippyplanner.model`) were
still the domain model all the way down to the JDBC layer, so a wire-format
change rippled into persistence.

## Decision

Layer the **whole backend** as a single onion and drop the per-module
boundaries. `com.trippyplanner` now has three rings, enforced by
`ArchUnit.onionArchitecture()` in `OnionArchitectureTest` (all rings
optional):

| Ring | Package | Contents |
|---|---|---|
| Domain model | `domain.model` | JDK only — the `Route` aggregate, `RouteNotFoundException`, `RouteAccessDeniedException` |
| Application | `application` | Use-case services + the ports they need: `RouteService`, `AuthService`, and the `RouteRepository` / `UserRepository` / `SessionRepository` / `EmailService` interfaces + `TokenGenerator` |
| Adapters | `adapter.{web,persistence,email}` | Controllers, `SecurityFilter`, `CurrentUser`, `RouteDtoMapper`; JDBC implementations of the ports; Resend |

- `ModuleArchitectureTest` is deleted and the module-boundaries ADR is
  superseded. `share` and `version` collapse into `adapter.web`; there is
  no longer a `share → routes` boundary — `ShareController` calls
  `application.RouteService` directly.
- The `routes.api` share-seam (`RouteQueryService` / `SharedRoute` /
  `DefaultRouteQueryService`) is gone. `RouteService` gains
  `findByShareToken` / `findSharedGpx`, and `ShareController` maps the
  domain `Route` plus its GPX to the DTO via `RouteDtoMapper`.
- **`CurrentUser` is a web-adapter type** (`adapter.web.CurrentUser`), not
  a domain one. It is the authenticated caller of an HTTP request: a user
  id plus the bearer session token, which is a transport detail. Nothing in
  the domain or application needs it: `AuthService` speaks plain values
  (`authenticate(token) → Optional<Long>`, `findEmail(userId)`,
  `signOut(sessionToken)`), `RouteService` takes a `long` user id, and
  `SecurityFilter` builds the `CurrentUser`. The generated
  `com.trippyplanner.api` interfaces reference it via
  `x-spring-provide-args` on the 9 `bearerAuth` operations in
  `openapi.yaml`. Those interfaces are web-adapter code that happens to be
  generated (controllers implement them), so the onion rule ignores
  dependencies originating from them and the cycle rule leaves the
  generated packages out, mirroring the `testsupport` exemption.
- **One `Route` aggregate, not one record per API operation.** An earlier
  draft had `NewRoute`, `RouteUpdate` and `RouteSummary` mirroring
  `CreateRouteRequest`, `UpdateRouteRequest` and `RouteListItem`; they were
  shapes of HTTP operations, not domain concepts. `Route` now owns its
  invariants and behaviour (`isOwnedBy`, idempotent `share`, `unshare`,
  `with…` edits); `isPublic` is derived from the share token.
  - *Use-case inputs are application commands, not domain types.*
    `CreateRouteCommand` and `UpdateRouteCommand` (in `application`) carry
    only caller-editable fields, so identity, owner and sharing state can't
    be supplied at all. `RouteService.create` builds the `Route`, assigning
    id, owner and creation time (from an injected `Clock`). The commands do
    mirror the request DTOs; that is accepted, because use-case inputs are
    expected to follow the API while the domain model stays free of it.
  - *Updates:* `UpdateRouteCommand` keeps the API's "null = unchanged"
    semantics; the service loads the route, applies the non-null fields via
    `Route.with…`, and saves the editable fields (last write wins). Sharing
    state is written by a separate `updateSharing`, so a concurrent edit
    can't resurrect a revoked share token.
  - *GPX is not part of `Route`.* It is immutable after creation, large,
    and only ever needed for one route at a time, so it travels as a
    `String` through dedicated methods (`RouteRepository.insert(route,
    gpx)` / `findGpx`, `RouteService.getGpx` / `findSharedGpx`). The list
    view simply returns `Route`s. The HTTP contract is unchanged: the
    controllers combine metadata and GPX where the API returns both.
- Ports live in `application`, not a `domain.service` ring (the hexagonal
  reading: with no domain logic that needs a repository, a separate ring
  would be empty).
- Extra rules cover what onion alone doesn't: the domain depends only on
  the JDK; `application` must not depend on Spring Web/HTTP/JDBC, the
  servlet API, or the generated DTOs; only `adapter.web` may touch the
  generated contract; and there are no cycles between classes, which also
  covers cycles inside a single ring (each top-level class is its own
  slice, nested classes count as part of their outer class).
- Domain exceptions (`RouteNotFoundException`, `RouteAccessDeniedException`,
  `UserNotFoundException`) are mapped to 404/403 in one
  `@RestControllerAdvice` (`DomainExceptionHandler`), so every controller
  gets the same mapping.

The module boundaries are intentionally **not** kept alongside the onion.
A global onion and a module matrix are two competing views of the same type
graph: once the modules are flattened into shared rings, `share` and
`routes` are the same application ring, so a "share may only reach routes
through an api" rule can no longer be expressed. Keeping the matrix would
mean paying for two overlapping layers.

## Alternatives considered

- **Per-module onion + keep the module matrix** (the original proposal of
  this record). The two axes overlap and the matrix must be re-expressed on
  every ring move; dropped in favour of the single global onion.
- **Keep the `routes.api` share-seam.** Fewer call sites in `share`, but it
  keeps a `routes.api` package and a third copy of the route type
  (`SharedRoute`). Dropped: the seam existed only to satisfy the module
  boundary, which is gone.
- **`CurrentUser` in `domain.model` or `application`.** An earlier draft put
  it in `domain.model`, reasoning that it was the only ring both the
  generated contract and `AuthService` could reach. That was wrong: the
  generated contract is exempt from the rules, so it can reach any ring,
  and the domain has no use for an HTTP principal. `application` would
  avoid the generated-interface cycle exemption, but carries the session
  token into the use-case layer. Revisit with a token-free
  `application.Caller` if authorisation ever needs more than a user id.
- **A separate `route_gpx` table.** It would mirror the model in the schema,
  but Postgres already stores large `TEXT` values out of line (TOAST), so
  metadata reads and updates don't touch the GPX today. It would cost a
  data migration with an irreversible column drop, a two-release rollout for
  zero-downtime deploys, and transactional inserts. Deferred until GPX
  storage itself changes (e.g. to object storage).
- **Spring Modulith / Maven multi-module.** As in the module-boundaries
  ADR: more framework and build cost than a ~ten-endpoint service warrants.

## Consequences

- **One less layer to maintain.** No `ModuleArchitectureTest`, no `.api`
  packages, no module matrix. The single `OnionArchitectureTest` is the
  whole structural test.
- **The `share` → `routes` boundary is gone.** `ShareController` can now
  reach any `RouteService` method (including writes), not just a read seam.
  For a read-only share endpoint today this is harmless, but a future
  module that should be read-only has no ArchUnit guard for it.
- **One domain type per concept.** The domain has a single `Route`; the
  API's four route shapes are mapped onto it in `RouteDtoMapper`. A new
  route field still touches the OpenAPI schema, `Route`, the mapper and the
  JDBC row mapper, but no longer a parallel family of domain records.
- **Less compiler help.** Services and ports are `public` to cross
  packages, so ArchUnit is the sole structural guard. The JDBC adapters
  stay package-private, and `@Repository` CGLIB proxying means they are not
  `final`.
- **The generated contract and `adapter.web` depend on each other**
  (controllers implement the `*Api` interfaces; the interfaces take
  `CurrentUser`). The onion rule ignores dependencies originating from the
  generated package, and the cycle rule excludes it. `openapi.yaml` names the Java
  package of `CurrentUser`, which only the Spring generator reads.
- **Last write wins on route edits.** Two concurrent edits to the same
  route overwrite each other's editable fields (previously each UPDATE
  wrote only the fields it was given). Routes are single-user, so this
  needs two tabs saving at the same moment; optimistic locking on
  `updated_at` is the upgrade path if it ever matters.
- **More queries on GPX-returning endpoints.** `GET /routes/{id}`,
  `PUT /routes/{id}` and `GET /share/{token}` load metadata and GPX
  separately (one or two extra round-trips). Negligible at this scale.
- **Faster use-case tests.** `RouteServiceTest` and `AuthServiceTest` are
  plain Mockito tests; controller tests cover only HTTP mapping.
- **Same HTTP behaviour for valid requests.** Status codes and error bodies
  are unchanged: the 404/403 handlers use `sendError` so Boot renders its
  standard error body, as `ResponseStatusException` did.
- **Invalid requests now get 400.** `spring-boot-starter-validation`
  enforces the `@NotNull` / `@Email` / `@Valid` constraints the OpenAPI
  generator already emits. Before, a missing required field (e.g.
  `avgSpeedKmh`) caused a 500, and a malformed email in
  `POST /auth/magic-link` was accepted.
- **`GET /auth/me` returns 404 if the user row is gone** while its session
  is still valid (previously a 500 from a bare `orElseThrow()`).
