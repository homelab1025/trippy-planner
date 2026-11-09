# ADR: Onion architecture inside each backend module

**Date:** 2026-11-09
**Status:** Proposed
**Related:** [ADR: Enforce backend module boundaries with ArchUnit](2026-11-09-backend-module-boundaries-archunit.md)

## Context

The module-boundaries ADR controls which modules may talk to each other.
It says nothing about structure *inside* a module. There, controllers
held use-case logic (ownership checks, session reuse, share-token reuse),
and the generated OpenAPI DTOs (`com.trippyplanner.model`) were used as
the domain model all the way down to the JDBC repositories. Any change to
the wire format therefore rippled into persistence code.

## Decision

Each module is structured as an onion. `ArchUnit.onionArchitecture()`
enforces this in `OnionArchitectureTest`, with all rings optional:

| Ring | Package | Contents |
|---|---|---|
| Domain model | `<module>.domain.model` | Records and domain exceptions; JDK only |
| Application | `<module>.application` | Use-case services plus the ports they need (repository / email interfaces) |
| Adapters | `<module>.adapter.{web,persistence,email}` | Controllers, filters and DTO mapping; JDBC implementations of the ports; Resend |

- `routes` has the full onion. `domain.model` holds `Route`,
  `RouteSummary`, `NewRoute`, `RouteUpdate`, `RouteNotFoundException` and
  `RouteAccessDeniedException`. `application.RouteService` owns the
  ownership and share-token logic. The web adapter maps DTOs to domain
  types and domain exceptions to 404/403.
- `auth` has no domain model, since there is nothing beyond ids and
  tokens yet. `application.AuthService` owns the magic-link, session
  lookup and sign-out logic. `SecurityFilter` authenticates through
  `AuthService` instead of reading the session table.
- `share` and `version` consist of a single web adapter each.
- Ports live in `application`, not in a `domain.service` ring. That is
  the hexagonal reading of onion. With no domain logic that needs a
  repository, a separate ring would be empty.
- Extra rules cover what onion alone doesn't: the domain depends only on
  the JDK; `application` must not depend on Spring Web/HTTP/JDBC, the
  servlet API, or the generated DTOs; and only web adapters may touch
  the generated contract.
- `routes.api.RouteQueryService` now returns `routes.api.SharedRoute`,
  its own record. Previously it returned the generated DTO. Published
  APIs may depend only on the JDK and other published APIs.

The module rules from the previous ADR stay as they are. Onion governs
the inside of a module, the module rules govern the edges between
modules, and neither replaces the other.

## Alternatives considered

- **Keep the flat structure inside modules.** For a CRUD service with
  about ten endpoints this is honestly competitive, because almost every
  domain type is a 1:1 copy of a DTO. The case for onion here is to
  separate wire format from domain before the domain grows behavior
  (planned weather, checkpoints and arrival-time logic), not that today's
  code needs it.
- **Ports in `domain.service`** (classic Palermo onion). Rejected for now
  because the ring would contain only interfaces.
- **Share the routes domain `Route` through `routes.api`.** Fewer types,
  but every domain change would then become a cross-module API change.

## Consequences

- **More types and mapping code.** `Route` now exists as the generated
  DTO, the domain record, and `routes.api.SharedRoute`, with three
  hand-written mappings (`RouteDtoMapper`, `DefaultRouteQueryService`,
  `ShareController`). Adding a field to a route means touching all of
  them.
- **Less compiler help.** Ports and services must be `public` to cross
  sub-packages, so the compiler no longer enforces module encapsulation.
  ArchUnit alone does. The JDBC adapters are still package-private.
- **JDBC adapters aren't `final`.** `@Repository` beans are CGLIB-proxied
  for exception translation, and CGLIB can't subclass a final class.
- **Faster use-case tests.** Use cases can now be tested without Spring
  or a database: `RouteServiceTest` and `AuthServiceTest` are plain
  Mockito tests. Controller tests now only cover HTTP mapping.
- **Same HTTP behavior as before.** Status codes and error bodies are
  unchanged: the 404/403 handlers use `sendError` so Boot renders its
  standard error body, as `ResponseStatusException` did.
