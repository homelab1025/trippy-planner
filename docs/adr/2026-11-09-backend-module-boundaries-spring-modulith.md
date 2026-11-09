# ADR: Enforce backend module boundaries with Spring Modulith

**Date:** 2026-11-09
**Status:** Accepted — supersedes [Enforce backend module boundaries with ArchUnit](2026-11-09-backend-module-boundaries-archunit.md)
**Related:** [ADR: Backend service, magic-link auth, and route persistence architecture](2026-07-18-backend-auth-and-persistence-architecture.md)

## Context

The [ArchUnit decision](2026-11-09-backend-module-boundaries-archunit.md) established the
backend module layout — `auth`, `routes`, `share`, `version`, plus leaf `common`, each with a
public surface other modules may use — and enforced it with ArchUnit. That same layout now
pivots its enforcement to **Spring Modulith** (2.1.2), which is Spring-native and gives more than
a pure rule check: a buildable module model, a module diagram, and (when needed later) event-based
asynchronous messaging between modules.

## Decision

**Use Spring Modulith to verify and document the module layout.**

- **Module = top-level package.** `com.trippyplanner.{auth, routes, share, version, common,
  testsupport, model, api}` — each top-level package under the root is a module. The generated
  OpenAPI contract packages `model` and `api` are modules too, but they are the shared contract,
  so every business module lists them in its `allowedDependencies`.
- **Public surface = the module's root package.** Spring Modulith 2.x has *no* per-subpackage
  public-API marker (the old `@ApplicationModuleType(PUBLIC_API)` was removed), so the public types
  were flattened into their module root: `auth.CurrentUser` and `routes.RouteQueryService` (former
  `auth.api` / `routes.api` sub-packages). This is the one deliberate deviation from the ArchUnit
  layout, forced by the framework's convention.
- **Explicit dependency declarations.** Each module's `*ModuleConfiguration`
  (`@ApplicationModule(allowedDependencies = …)`) lists its permitted upstream modules:
  `auth → common, model, api`; `routes → auth, common, model, api`; `share → routes, model, api`;
  `version → model, api`; `common → (none)`; `testsupport → auth`.
- **One test, verify + document.** `ModuleArchitectureTest` builds the model from the classpath —
  `ApplicationModules.of(TrippyPlannerApplication.class).verify()` — which fails the build on any
  boundary violation, and writes PlantUML diagrams to `target/spring-modulith-docs/`. Because the
  model comes from the compiled classpath, the test needs **no database or Spring context**.
- **Enforcement is gated by the test.** `mvn test` runs `ModuleArchitectureTest`; a violation fails
  CI. `spring-modulith-starter-core` (compile scope) additionally runs Modulith's own module
  verification at startup.

## Consequences

- A richer, Spring-native framework replaces the ArchUnit-only dependency; ArchUnit is no longer a
  direct dependency (it remains transitively, because Modulith uses it internally).
- The public surface moved from an `api/` sub-package to the module root — a visible, documented
  layout change.
- A module diagram is regenerated under `target/spring-modulith-docs/` on every `mvn test`.
- **Domain events remain deferred** — same rationale as the ArchUnit decision:
  `RouteShared`/`SessionCreated`/`SessionDeleted`/`RouteDeleted` have no consumers yet, so
  publishing them would be dead code. Modulith makes them a clean add when a consumer exists,
  but we do not add empty wiring.
- `@ApplicationModule` uses `allowedDependencies` (the annotation attribute name in 2.x) and
  `@ApplicationModule.Type` is only `OPEN`/`CLOSED`; modules are `@Configuration(proxyBeanMethods = false)`.
