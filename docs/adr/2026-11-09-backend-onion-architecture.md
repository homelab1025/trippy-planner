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
| Domain model | `domain.model` | Records + domain exceptions; JDK only — `Route`, `RouteSummary`, `NewRoute`, `RouteUpdate`, `RouteNotFoundException`, `RouteAccessDeniedException`, `CurrentUser` |
| Application | `application` | Use-case services + the ports they need: `RouteService`, `AuthService`, and the `RouteRepository` / `UserRepository` / `SessionRepository` / `EmailService` interfaces + `TokenGenerator` |
| Adapters | `adapter.{web,persistence,email}` | Controllers, `SecurityFilter`, `RouteDtoMapper`; JDBC implementations of the ports; Resend |

- `ModuleArchitectureTest` is deleted and the module-boundaries ADR is
  superseded. `share` and `version` collapse into `adapter.web`; there is
  no longer a `share → routes` boundary — `ShareController` calls
  `application.RouteService` directly.
- The `routes.api` share-seam (`RouteQueryService` / `SharedRoute` /
  `DefaultRouteQueryService`) is gone. `RouteService` gains
  `findByShareToken`, and `ShareController` maps the domain `Route` to the
  DTO via `RouteDtoMapper.toSharedDto`, which forces `isPublic = true` to
  preserve the old behaviour.
- `CurrentUser` moves from `auth.api` into `domain.model`. The generated
  `com.trippyplanner.api` contract references it via
  `x-spring-provide-args` on the 9 `bearerAuth` operations in
  `openapi.yaml`; that edge sits outside the onion, so the rule ignores
  dependencies originating from the generated contract, mirroring the
  `testsupport` exemption.
- Ports live in `application`, not a `domain.service` ring (the hexagonal
  reading: with no domain logic that needs a repository, a separate ring
  would be empty).
- Extra rules cover what onion alone doesn't: the domain depends only on
  the JDK; `application` must not depend on Spring Web/HTTP/JDBC, the
  servlet API, or the generated DTOs; only `adapter.web` may touch the
  generated contract; and top-level packages are free of cycles.

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
- **`CurrentUser` in a web/adapter ring.** `AuthService` (application)
  consumes it and inner→outer is forbidden, so it cannot live in an adapter
  ring; `domain.model` is the only ring both the generated contract and the
  application can reach.
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
- **`Route` still exists twice** (generated DTO + domain record), with one
  mapping (`RouteDtoMapper`, including `toSharedDto`) — one fewer than the
  per-module version, since `SharedRoute` / `DefaultRouteQueryService` are
  gone.
- **Less compiler help.** Services and ports are `public` to cross
  packages, so ArchUnit is the sole structural guard. The JDBC adapters
  stay package-private, and `@Repository` CGLIB proxying means they are not
  `final`.
- **The generated contract reaches into `domain.model`** via
  `x-spring-provide-args`; that one edge is ignored by the onion rule,
  exactly as the old `ModuleArchitectureTest` ignored its equivalent.
- **Faster use-case tests.** `RouteServiceTest` and `AuthServiceTest` are
  plain Mockito tests; controller tests cover only HTTP mapping.
- **Same HTTP behaviour.** Status codes and error bodies are unchanged: the
  404/403 handlers use `sendError` so Boot renders its standard error body,
  as `ResponseStatusException` did.
