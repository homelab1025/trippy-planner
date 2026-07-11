# K8s DB Secret Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded DB credentials in `trippy-backend-secret` with references to the existing `trippy-db-password` secret in the `trippy-planner` namespace.

**Architecture:** Update `backend-deployment.yaml` to use individual `env` entries with `secretKeyRef` instead of `envFrom`. Concatenate host, port, and name from the secret into `SPRING_DATASOURCE_URL`. Delete `backend-secret.yaml` and remove it from `kustomization.yaml`.

**Tech Stack:** Kubernetes (Kustomize), Kubernetes Deployment YAML

## Global Constraints

- The secret name is `trippy-db-password`, namespace is `trippy-planner`
- Secret keys: `username`, `password`, `host`, `name`, `port`, `resend_api_key`
- `APP_BASE_URL` and `SESSION_EXPIRY_MINUTES` remain non-secret env vars (unchanged)
- `docker-compose.yml` is unaffected (local dev uses inline env vars)
- `application.properties` is unaffected (already reads from env vars)
- `application-local.properties` is unaffected (local dev uses hardcoded values)

---

### Task 1: Update backend-deployment.yaml to use secretKeyRef

**Files:**
- Modify: `k8s/base/backend-deployment.yaml`

**Interfaces:**
- Consumes: `trippy-secret` secret keys: `db.username`, `db.password`, `db.host`, `db.port`, `db.name`, `resend.api_key`
- Produces: Updated env block with `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `SPRING_DATASOURCE_URL`, `RESEND_API_KEY` from secret refs, plus `APP_BASE_URL` and `SESSION_EXPIRY_MINUTES` as plain env vars

- [ ] **Step 1: Replace envFrom with individual env entries**

Replace the `envFrom` block in `k8s/base/backend-deployment.yaml` with individual `env` entries:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trippy-backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: trippy-backend
  template:
    metadata:
      labels:
        app: trippy-backend
    spec:
      containers:
        - name: trippy-backend
          image: trippy-backend:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 8080
              name: http
          env:
            - name: SPRING_DATASOURCE_USERNAME
              valueFrom:
                secretKeyRef:
                  name: trippy-secret
                  key: db.username
            - name: SPRING_DATASOURCE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: trippy-secret
                  key: db.password
            - name: SPRING_DATASOURCE_URL
              value: "jdbc:postgresql://$(DB_HOST):$(DB_PORT)/$(DB_NAME)"
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: trippy-secret
                  key: db.host
            - name: DB_PORT
              valueFrom:
                secretKeyRef:
                  name: trippy-secret
                  key: db.port
            - name: DB_NAME
              valueFrom:
                secretKeyRef:
                  name: trippy-secret
                  key: db.name
            - name: RESEND_API_KEY
              valueFrom:
                secretKeyRef:
                  name: trippy-secret
                  key: resend.api_key
            - name: APP_BASE_URL
              value: "https://trippy.lab.wicked"
            - name: SESSION_EXPIRY_MINUTES
              value: "43200"
```

Note: `SPRING_DATASOURCE_URL` uses env var substitution (`$(DB_HOST):$(DB_PORT)/$(DB_NAME)`) to concatenate the three secret keys into the JDBC URL. K8s supports this natively — the shell-like variable expansion is resolved before the container starts.

- [ ] **Step 2: Verify the YAML syntax**

Run: `kubectl --dry-run=client -o yaml -f k8s/base/backend-deployment.yaml` (or just validate with `python -c "import yaml; yaml.safe_load(open('k8s/base/backend-deployment.yaml'))"`)

Expected: No YAML parse errors.

- [ ] **Step 3: Commit**

```bash
git add k8s/base/backend-deployment.yaml
git commit -m "feat: use trippy-db-password secret for backend env vars

Replace envFrom with individual secretKeyRef entries mapping
trippy-db-password keys (username, password, host, port, name,
resend_api_key) to Spring Boot properties. APP_BASE_URL and
SESSION_EXPIRY_MINUTES remain as plain env vars."
```

### Task 2: Delete backend-secret.yaml and update kustomization.yaml

**Files:**
- Delete: `k8s/base/backend-secret.yaml`
- Modify: `k8s/base/kustomization.yaml`

**Interfaces:**
- Consumes: none
- Produces: Cleaned-up kustomization with no reference to the deleted secret

- [ ] **Step 1: Delete backend-secret.yaml**

```bash
rm k8s/base/backend-secret.yaml
```

- [ ] **Step 2: Update kustomization.yaml**

Remove `backend-secret.yaml` from the resources list. The current `kustomization.yaml` does not include `backend-secret.yaml` in its resources (it only lists `deployment.yaml`, `service.yaml`, `ingress.yaml`), so no change is needed here. Verify:

```bash
cat k8s/base/kustomization.yaml
```

Expected output:
```yaml
resources:
  - deployment.yaml
  - service.yaml
  - ingress.yaml
```

No modification needed — `backend-secret.yaml` was never listed as a resource.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused backend-secret.yaml

The secret is no longer needed since all DB credentials and
RESEND_API_KEY are now sourced from trippy-db-password via
secretKeyRef in the deployment."
```

### Task 3: Verify end-to-end

**Files:**
- Verify: `k8s/base/backend-deployment.yaml`
- Verify: `docker-compose.yml` (no changes expected)
- Verify: `backend/src/main/resources/application.properties` (no changes expected)

**Interfaces:**
- Consumes: the updated deployment manifest
- Produces: Confidence that the change is correct

- [ ] **Step 1: Confirm no other files reference trippy-backend-secret**

```bash
grep -r "trippy-backend-secret" --include="*.yaml" --include="*.yml" --include="*.java" --include="*.properties" --include="*.md" .
```

Expected: Only matches in `k8s/base/backend-secret.yaml` (which is now deleted) and possibly the spec file. No other references.

- [ ] **Step 2: Confirm docker-compose.yml is unchanged**

```bash
grep "SPRING_DATASOURCE" docker-compose.yml
```

Expected: Inline env vars for local dev, no reference to `trippy-backend-secret`.

- [ ] **Step 3: Confirm application.properties is unchanged**

```bash
grep "datasource" backend/src/main/resources/application.properties
```

Expected: Still reads `${SPRING_DATASOURCE_URL}`, `${SPRING_DATASOURCE_USERNAME}`, `${SPRING_DATASOURCE_PASSWORD}` from env vars.

- [ ] **Step 4: Final commit (if needed)**

```bash
git add -A
git commit -m "verify: no stray references to trippy-backend-secret"
```
