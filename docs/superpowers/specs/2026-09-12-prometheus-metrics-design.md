# Prometheus Metrics for the Backend API — Design Spec

## Context

We want the backend API's metrics collected and served in Prometheus format. Prometheus runs in the same k8s cluster and scrapes the `trippy-backend` service directly.

The backend already depends on `spring-boot-starter-actuator`, but only the `health` endpoint is web-exposed, and it lives on the main port (8080) behind `SecurityFilter`'s host allowlist (`localhost`, `trippy.lab.wicked`). That allowlist keys on the `Host` header, which is fully client-controlled — anyone can send `Host: localhost` and pass. Acceptable for a health status, but not a gate we want to extend to full JVM/request metrics.

Agreed direction:

- Serve metrics on a **separate management port (8081)** that is not exposed via the ingress — cluster-internal only, so it is unreachable from the internet regardless of any filter.
- Expose **Spring Boot's default metrics** (auto-configured once the Prometheus registry is on the classpath: `http.server.requests`, JVM, Tomcat, Hikari, …) plus **four custom business events**.
- Custom metrics go through a **central `Metrics` component** (names in one place, trivially testable) rather than scattered `MeterRegistry` calls in each controller/service.

## Design

### 1. Prometheus registry dependency

`backend/pom.xml`: add `io.micrometer:micrometer-registry-prometheus` (version managed by the Spring Boot BOM). Once on the classpath, Spring Boot auto-configures a Prometheus `MeterRegistry` and the `prometheus` actuator endpoint.

### 2. Management port configuration

`backend/src/main/resources/application.properties`:

```properties
management.server.port=8081
management.endpoints.web.exposure.include=health,prometheus
```

This moves **all** web actuator endpoints (health + prometheus) off 8080 onto 8081. The exact base path on 8081 (whether the management server inherits the main `/api` servlet context path) is confirmed during implementation; the docker-compose healthcheck and the reference scrape config use the confirmed URL.

### 3. `SecurityFilter` change

Spring Boot's separate management server is a child application context and inherits the main context's `FilterRegistrationBean`s, so `SecurityFilter` also runs on 8081. Left as-is, it would 401 Prometheus (scrapes carry no Bearer token).

Change: the filter **passes through any request whose URI contains `/actuator/`**, and the now-dead host-allowlist logic is deleted (`ACTUATOR_HEALTH_PATH`, `ACTUATOR_HEALTH_ALLOWED_HOSTS`, `isAllowedHealthHost`, `hostnameOnly`).

This is safe in both directions:

- On 8080, `/api/actuator/*` no longer exists (404) — the pass-through cannot expose anything.
- On 8081, actuator is reachable without a Bearer token, but the port is not in the ingress, so it is not reachable from the internet.

The endpoint integration test (below) verifies the prometheus endpoint is reachable without auth, which holds whether or not the filter actually applies to the management port.

### 4. Custom business metrics

New `Metrics` bean in `com.trippyplanner.common` wrapping the injected `MeterRegistry`, with one method per event:

| Method | Metric (Prometheus name) | Type | Instrumentation point |
|---|---|---|---|
| `routeSaved()` | `trippy_routes_saved_total` | counter | `RoutesController.createRoute`, after a successful save |
| `routeDeleted()` | `trippy_routes_deleted_total` | counter | `RoutesController.deleteRoute`, after a successful delete |
| `shareCreated()` | `trippy_shares_created_total` | counter | `RoutesController.shareRoute`, **only** when a new token is generated (the `orElseGet` branch) — returning an existing token does not count |
| `signinAttempted(boolean success)` | `trippy_signins_attempted_total{result}` | counter | `AuthController.requestMagicLink`; `result=success` if `emailService.sendMagicLink` returned, `failure` if it threw (the exception still propagates as today) |
| `magicLinkSent(boolean success, Duration duration)` | `trippy_magic_links_sent_total{result}` + `trippy_magic_link_send_seconds` | counter + timer | `ResendEmailService.sendMagicLink`, around the Resend API call |

Notes:

- `ResendEmailService` is `@Profile("!e2e & !local")`, so the two `magic_link` metrics only fire in production; `trippy_signins_attempted` fires in all profiles (it is in the controller).
- `trippy_signins_attempted` (whole `requestMagicLink` outcome) and `trippy_magic_links_sent` (the Resend call itself) sit at different layers; both are kept deliberately.
- `shareRoute` currently reads `findShareToken(id).orElseGet(...)`; the change makes the branch explicit so only new creations increment the counter.

### 5. Deployment

- `k8s/base/backend-deployment.yaml`: add `containerPort: 8081` (name `metrics`).
- `k8s/base/backend-service.yaml`: add a second port `8081 → 8081` (name `metrics`) so in-cluster Prometheus can scrape `trippy-backend:8081`.
- **No ingress change** — metrics must stay out of the public path.
- `docker-compose.yml`: backend healthcheck → `http://localhost:8081/actuator/health` (confirmed path); expose `${BACKEND_METRICS_PORT:-8081}:8081` for local curling.
- Reference scrape config (for the cluster's Prometheus; not committed as k8s resources in this repo):

  ```yaml
  scrape_configs:
    - job_name: trippy-backend
      metrics_path: /actuator/prometheus # confirmed path
      static_configs:
        - targets: ["trippy-backend:8081"]
  ```

## Testing

- **`Metrics` unit test** with a `SimpleMeterRegistry`: each method records the expected metric name and tags.
- **Controller tests** (existing `@WebMvcTest` style): provide a `Metrics` backed by a `SimpleMeterRegistry` via `@TestConfiguration`/`@Import` and assert the right counter fires — including `shareRoute` counting only new tokens, and `requestMagicLink` tagging success vs. failure.
- **`ResendEmailServiceTest`** (existing Mockito test): assert `magicLinkSent` records the counter + timer on success, and the failure tag when the mocked `RestClient` throws.
- **Endpoint integration test** (`@SpringBootTest(webEnvironment = RANDOM_PORT)` + Testcontainers, following `MigrationTest`), with the `local` profile (activates `InMemoryEmailService`, so no real Resend call) and `management.server.port=0` (random management port, read from the `local.management.port` property so the test never collides with a locally running backend):
  - `GET /actuator/prometheus` on the management port returns 200 with **no** Bearer token and contains `http_server_requests`, `jvm_memory_used`, and — after driving a route save, a share, and a magic-link request through the API (session created directly via `SessionRepository`) — `trippy_routes_saved_total`, `trippy_shares_created_total`, and `trippy_signins_attempted_total{result="success"}`.
  - `GET /api/actuator/health` on the main port is no longer served (404).
- Full backend suite (`./mvnw test`) stays green.

## Out of scope

- Grafana dashboards, alerting rules, and the Prometheus deployment itself — only the endpoint and a reference scrape snippet.
- No `openapi.yaml` change (actuator is not part of the API contract); no version bump (backend is already `2.9.0-SNAPSHOT`, in-development).
- **Operational note:** health is no longer reachable at `https://trippy.lab.wicked/api/actuator/health`; use the management port instead (e.g. `kubectl port-forward` to 8081).
