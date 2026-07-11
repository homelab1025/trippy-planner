# Rename Secret and Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the K8s secret from `trippy-db-password` to `trippy-secret` and rename all keys inside it to dot-notation (`db.username`, `db.password`, `db.host`, `db.port`, `db.name`, `resend.api_key`).

**Architecture:** Single-file change to `k8s/base/backend-deployment.yaml` — update all `secretKeyRef.name` from `trippy-db-password` to `trippy-secret`, and update all `secretKeyRef.key` values to the new dot-notation names.

**Tech Stack:** Kubernetes (Kustomize)

## Global Constraints

- Secret name: `trippy-secret` (was `trippy-db-password`)
- Secret keys: `db.username`, `db.password`, `db.host`, `db.port`, `db.name`, `resend.api_key`
- No code changes needed — `application.properties` still reads the same env var names
- `docker-compose.yml` is unaffected

---

### Task 1: Update backend-deployment.yaml with new secret name and keys

**Files:**
- Modify: `k8s/base/backend-deployment.yaml`

**Interfaces:**
- Consumes: `trippy-secret` secret with keys: `db.username`, `db.password`, `db.host`, `db.port`, `db.name`, `resend.api_key`
- Produces: Updated env block referencing the renamed secret and keys

- [ ] **Step 1: Replace all secretKeyRef entries**

Update `k8s/base/backend-deployment.yaml` to use the new secret name `trippy-secret` and the new dot-notation keys:

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

Changes:
- `secretKeyRef.name`: `trippy-db-password` → `trippy-secret` (all 6 references)
- `secretKeyRef.key`: `username` → `db.username`, `password` → `db.password`, `host` → `db.host`, `port` → `db.port`, `name` → `db.name`, `resend_api_key` → `resend.api_key`

- [ ] **Step 2: Verify the YAML syntax**

```bash
node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('k8s/base/backend-deployment.yaml', 'utf8')); console.log('YAML is valid')"
```

Expected: `YAML is valid`

- [ ] **Step 3: Confirm no other files reference the old secret name**

```bash
grep -r "trippy-db-password" --include="*.yaml" --include="*.yml" --include="*.java" --include="*.properties" . 2>/dev/null | grep -v node_modules | grep -v target | grep -v .git
```

Expected: Only matches in spec/plan docs (not live config).

- [ ] **Step 4: Commit**

```bash
git add k8s/base/backend-deployment.yaml
git commit -m "refactor: rename secret to trippy-secret and use dot-notation keys

Rename secret from trippy-db-password to trippy-secret.
Rename keys: username->db.username, password->db.password,
host->db.host, port->db.port, name->db.name,
resend_api_key->resend.api_key."
```
