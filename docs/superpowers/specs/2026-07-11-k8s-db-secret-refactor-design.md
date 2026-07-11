# K8s DB Secret Refactor — Use `trippy-db-password` Secret

> **Goal:** Replace hardcoded DB credentials in `trippy-backend-secret` with references to the existing `trippy-db-password` secret in the `trippy-planner` namespace, using individual `env`/`valueFrom.secretKeyRef` mappings in the backend deployment.

**Architecture:** The backend Spring Boot app already reads `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, and `RESEND_API_KEY` from environment variables. The K8s deployment will be updated to populate these env vars by referencing individual keys from the `trippy-db-password` secret. The JDBC URL will be constructed by concatenating host, port, and name keys from the secret.

**Tech Stack:** Kubernetes (Kustomize), Spring Boot, PostgreSQL

---

## Global Constraints

- The secret name is `trippy-secret`, namespace is `trippy-planner`
- Secret keys: `db.username`, `db.password`, `db.host`, `db.name`, `db.port`, `resend.api_key`
- `APP_BASE_URL` and `SESSION_EXPIRY_MINUTES` remain non-secret env vars (unchanged)
- `docker-compose.yml` is unaffected (local dev uses inline env vars)
- `application.properties` is unaffected (already reads from env vars)
- `application-local.properties` is unaffected (local dev uses hardcoded values)

---

## Changes

### 1. `k8s/base/backend-deployment.yaml`

Add individual `env` entries under the backend container that map keys from `trippy-secret` to Spring Boot properties:

| Env var | Source |
|---|---|
| `SPRING_DATASOURCE_USERNAME` | `secretKeyRef: trippy-secret → db.username` |
| `SPRING_DATASOURCE_PASSWORD` | `secretKeyRef: trippy-secret → db.password` |
| `SPRING_DATASOURCE_URL` | `secretKeyRef: trippy-secret → db.host` + `:db.port/db.name` (concatenated in the deployment YAML using env var references or a single concatenated value) |
| `RESEND_API_KEY` | `secretKeyRef: trippy-secret → resend.api_key` |

`APP_BASE_URL` and `SESSION_EXPIRY_MINUTES` remain as plain `env` entries (as they are today).

The `envFrom` block referencing `trippy-backend-secret` is removed.

### 2. `k8s/base/backend-secret.yaml`

**Delete this file.** It no longer serves any purpose — all its keys (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `RESEND_API_KEY`) now come from `trippy-db-password`.

### 3. `k8s/base/kustomization.yaml`

Remove `backend-secret.yaml` from the `resources` list (it no longer exists).

### 4. `docker-compose.yml`

No changes. Local development continues to use inline environment variables.

### 5. `backend/src/main/resources/application.properties`

No changes. Already reads `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` from env vars.

### 6. `backend/src/main/resources/application-local.properties`

No changes. Local dev continues to use hardcoded values.

---

## Data Flow

```
trippy-secret (namespace: trippy-planner)
  ├── db.username        ──→ SPRING_DATASOURCE_USERNAME
  ├── db.password        ──→ SPRING_DATASOURCE_PASSWORD
  ├── db.host            ──┐
  ├── db.port            ──┼──→ SPRING_DATASOURCE_URL (concatenated)
  └── db.name            ──┘
  └── resend.api_key     ──→ RESEND_API_KEY
```

---

## Rollback

- Re-create `backend-secret.yaml` with the original values and restore `envFrom` in the deployment.
- No code changes are needed.
