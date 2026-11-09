# ADR: Enforce backend module boundaries with ArchUnit

**Date:** 2026-11-09
**Status:** Accepted
**Related:** [ADR: Backend service, magic-link auth, and route persistence architecture](2026-07-18-backend-auth-and-persistence-architecture.md)

## Context

The backend's top-level packages (`auth`, `routes`, `share`, `version`,
`common`) looked like modules but had no enforced boundaries:

- `common` depended on `auth` (`SecurityFilter` and `FilterConfig` needed
  `SessionRepository`), so the supposed leaf package wasn't one.
- `share.ShareController` used `routes.RouteRepository` directly, so it
  could reach every write method on routes.
- The caller's identity moved between modules through untyped strings:
  `request.setAttribute("userId", …)` in the filter, then
  `(Long) request.getAttribute("userId")` in each controller.

Nothing stopped these dependencies from spreading.

## Decision

- Each top-level package under `com.trippyplanner` is a module. A module's
  `api` sub-package is the only part other modules may depend on.
- Layout:
  - `auth` owns users, sessions, the `SecurityFilter`, and its registration.
    `auth.api.CurrentUser` is an immutable record (`userId`,
    `sessionToken`) that controllers receive as a **method argument**:
    every `bearerAuth` operation in `openapi.yaml` declares
    `x-spring-provide-args: [com.trippyplanner.auth.api.CurrentUser currentUser]`,
    so the generated interfaces carry the parameter. `SecurityFilter`
    stores the record on the request, and `auth`'s
    `CurrentUserArgumentResolver` hands it to the controller. No
    controller injects `HttpServletRequest` or any other request-bound
    object, and public operations like `requestMagicLink` don't take the
    parameter at all.
  - `routes` owns route persistence. `routes.api.RouteQueryService` holds
    the read operations other modules need, currently only
    `findByShareToken`.
  - `share` depends only on `routes.api`.
  - `version` depends on nothing internal.
  - `common` is a leaf holding only `TokenGenerator`. The request-logging
    filter moved to the root package (`RequestLoggingConfig`) because it
    doesn't belong to any module.
- Allowed module dependencies: `auth → common`, `routes → auth, common`,
  `share → routes`. `ModuleArchitectureTest` enforces these. It also
  checks that no module reaches a non-`api` package of `auth` or `routes`,
  that `api` packages don't expose internal types, and that top-level
  packages have no cycles.
- Repositories are package-private, so the compiler blocks most
  violations before ArchUnit runs.
- `testsupport` (e2e/local scaffolding) may use `auth` internals, since
  it implements the `EmailService` SPI. No production module may depend
  on it.
- The generated OpenAPI packages (`com.trippyplanner.api`, `.model`) are
  the shared contract and aren't modelled as modules.

## Alternatives considered

- **Spring Modulith.** It is built for this: module verification on top
  of ArchUnit, named interfaces, documentation generation, and event
  publication. It was rejected for now because its default convention is
  the inverse of ours (a module's root package is public and its
  sub-packages are internal). It would also add a framework dependency to
  enforce five packages. If cross-module events become real (see below),
  revisit this, because the event-publication registry is its strongest
  feature.
- **Maven multi-module / JPMS.** Gives compile-time enforcement but costs
  a lot of build and packaging work for a service this size.
- **Injecting `CurrentUser` (or `HttpServletRequest`) into controller
  constructors.** This is what the controllers did before this change,
  and what the first version of this change did with a singleton
  `CurrentUser` backed by Spring's request proxy. It works, because the
  proxy resolves the current request from a thread-local on each call.
  But a per-request value then looks like a constructor dependency, it
  fails at runtime off the request thread, and the constructor carries a
  dependency that public endpoints must not use.
- **`includeHttpRequestContext=true`** (the generator adds
  `HttpServletRequest` to every method). It keeps Java type names out of
  the contract, but it puts a servlet type on every controller method,
  public ones included, and still needs a lookup from the request to
  `CurrentUser`.
- **Domain events now** (`SessionCreated`, `RouteShared`, `RouteDeleted`,
  …). Deferred: no consumer exists yet, and publishing events nobody
  listens to is dead code. Add an event when a second module needs to
  react to one.

## Consequences

- A new cross-module dependency needs either an `api` type or an update
  to the allowed-dependency list in `ModuleArchitectureTest`. Either way
  the change shows up in review.
- A new top-level package isn't covered by the layer rules until it is
  added to `ModuleArchitectureTest`. Only the cycle check covers it
  automatically.
- The boundary exists in code only. The database schema is still shared
  (`routes.user_id` references `users.id`), so a module can still couple
  to another at the SQL level.
- `openapi.yaml` now names a Java type
  (`com.trippyplanner.auth.api.CurrentUser`). Other generators ignore
  `x-spring-*` extensions, but moving or renaming `CurrentUser` means
  editing the contract, and ArchUnit doesn't read the yaml.
- The generated `com.trippyplanner.api` package depends on `auth.api`,
  while `AuthController` implements `AuthApi`. The cycle rule ignores
  exactly that one edge.
- Whether an operation gets a `CurrentUser` is declared in two places:
  `bearerAuth` + `x-spring-provide-args` in the contract, and
  `SecurityFilter.PUBLIC_PATHS`. If a path is public in the filter but
  declares `CurrentUser`, the resolver throws `IllegalStateException`
  (500) instead of silently running without a user.
- `SecurityFilter.PUBLIC_PATHS` still lists URLs owned by `share`,
  `version`, and `testsupport`. `auth` knows about other modules'
  endpoints, but only as strings, so ArchUnit can't catch it.
