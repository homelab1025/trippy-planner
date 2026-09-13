# ADR: Serve Prometheus metrics on a separate, cluster-internal management port

**Date:** 2026-09-13
**Status:** Accepted
**Related:** none

## Context

We wanted the backend's APIs to expose metrics in Prometheus format,
relying on Spring Boot Actuator + Micrometer rather than hand-rolled
instrumentation. The backend already enforces access with its own
`SecurityFilter` — a plain servlet `Filter` (not Spring Security)
requiring a `Bearer` session token on every request except a small
allowlist, plus a Host-header carve-out for `/actuator/health` (needed
for the docker-compose healthcheck and direct operator access).

Fitting `/actuator/prometheus` into that model was awkward: a
Prometheus `ServiceMonitor` scrapes without presenting any app-level
credential, so the endpoint would need either a spoofable Host-header
carve-out like health's, a dedicated scrape token, or full public
exposure. None were acceptable — actuator's endpoint set can leak JVM
and HTTP internals, and this app has no LAN/VPN boundary beyond the
Kubernetes cluster network itself.

## Decision

- Set `management.server.port=8081`, moving all actuator web endpoints
  (`health`, `prometheus`) onto a separate embedded Tomcat connector,
  entirely outside the main application's servlet context. Endpoints
  on this port live at `/actuator/...` with no `/api` prefix —
  `server.servlet.context-path` only applies to the main connector.
- Rely on that port boundary for access control instead of an
  app-level check: Spring Boot's `FilterRegistrationBean`-registered
  filters (`SecurityFilter`, `CommonsRequestLoggingFilter`) attach to
  the main dispatcher only, so they never run for the management port.
  The k8s `trippy-backend` Service adds a `metrics` port (8081) but
  stays `ClusterIP` and isn't referenced by the ingress; nginx's
  reverse proxy only forwards `/api/` to the app port (8080), never to
  8081. So port 8081 is reachable from any pod in the cluster, but
  from nowhere outside it.
- Deleted `SecurityFilter`'s Host-header allowlist logic for
  `/actuator/health` (`ACTUATOR_HEALTH_PATH`,
  `ACTUATOR_HEALTH_ALLOWED_HOSTS`, and the `hostnameOnly`/
  `isAllowedHealthHost` helpers) along with the five tests exercising
  it, since that code path is now unreachable — health only ever
  arrives on the management port.
- Added a Prometheus Operator `ServiceMonitor`
  (`k8s/base/backend-servicemonitor.yaml`) targeting the `metrics`
  port and `/actuator/prometheus` path on a 30s interval, assuming the
  operator is already installed in-cluster.
- Updated the docker-compose healthcheck to hit the new port/path
  directly (`http://localhost:8081/actuator/health`).

## Consequences

- Metrics and health are cluster-internal only by construction — a
  property of the port and Service/ingress wiring, not a spoofable
  per-request header check. This is a stronger boundary than the old
  Host-header carve-out.
- Local manual checks (`curl`/`wget`) of health or metrics need port
  8081, not 8080. docker-compose doesn't publish 8081 to the host, so
  reaching it from outside the container requires either publishing
  the port or exec-ing in.
- Actuator traffic no longer passes through `CommonsRequestLoggingFilter`,
  so scrape/health requests won't appear in the app's request logs —
  acceptable, and arguably preferable given a 30s scrape interval.
- The management port has no app-level auth of its own — any endpoint
  later added to `management.endpoints.web.exposure.include` (e.g.
  `env`, `heapdump`) is exposed to every pod in the cluster, not just
  Prometheus. Anything sensitive added there needs a stronger control
  than "yet another actuator endpoint on this port."
