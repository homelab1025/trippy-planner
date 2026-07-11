# GHCR Image Build Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the CI build pipeline to build and push both frontend and backend Docker images to GHCR, and update K8s manifests to reference GHCR images.

**Architecture:** Two build jobs in `build.yml` — one for frontend, one for backend — each using `docker/build-push-action` with the correct context and Dockerfile. K8s base deployments reference `ghcr.io/homelab1025/trippy-planner` directly (no overlay needed). Prod overlay patches the tag only.

**Tech Stack:** GitHub Actions, Docker, Kustomize, GHCR

## Global Constraints

- Registry: `ghcr.io`
- Image name: `ghcr.io/homelab1025/trippy-planner`
- Tags: `<version>` (from frontend package.json) and `latest`
- Frontend image: built from `frontend/Dockerfile`
- Backend image: built from `backend/Dockerfile`
- Runs on self-hosted runner
- Unit tests + E2E tests must pass before build

---

### Task 1: Update build.yml to build and push both images

**Files:**
- Modify: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: `frontend/package.json` for version, `frontend/Dockerfile`, `backend/Dockerfile`
- Produces: Two GHCR images: `ghcr.io/homelab1025/trippy-planner:<version>` and `ghcr.io/homelab1025/trippy-planner:latest`

- [ ] **Step 1: Rewrite build.yml**

Replace the entire `build.yml` with a pipeline that builds both images:

```yaml
name: Build

on:
  push:
    branches: ["master"]
  pull_request:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  unit-test:
    runs-on: self-hosted
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Run unit tests
        run: |
          docker run --rm \
            --user $(id -u):$(id -g) \
            --env HOME=/tmp \
            -v "${{ github.workspace }}:/app" \
            -w /app/frontend \
            node:24-alpine \
            sh -c "npm ci && npx vitest run"

  e2e-test:
    runs-on: self-hosted
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Run E2E tests
        run: |
          docker run --rm \
            --user $(id -u):$(id -g) \
            --env HOME=/tmp \
            --ipc=host \
            --security-opt seccomp=unconfined \
            -v "${{ github.workspace }}:/app" \
            -w /app/frontend \
            mcr.microsoft.com/playwright:v1.60.0-noble \
            sh -c "npm ci && npx playwright test"

  build:
    runs-on: self-hosted
    needs: [unit-test, e2e-test]
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Set Release Version
        id: set_version
        run: |
          VERSION=$(node -p "require('./frontend/package.json').version")
          echo "version=$VERSION" >> $GITHUB_OUTPUT
        shell: bash

      - name: Log in to the Container registry
        uses: docker/login-action@v4
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push frontend image
        uses: docker/build-push-action@v7
        with:
          context: frontend
          file: frontend/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:${{ steps.set_version.outputs.version }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:latest

      - name: Build and push backend image
        uses: docker/build-push-action@v7
        with:
          context: backend
          file: backend/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:${{ steps.set_version.outputs.version }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:latest
```

Key changes:
- Unit test and E2E test workdirs changed to `/app/frontend` (where package.json lives)
- Version read from `./frontend/package.json` instead of `./package.json`
- Two separate `docker/build-push-action` steps — one for frontend, one for backend
- Image names: `<repo>-frontend` and `<repo>-backend` (e.g., `ghcr.io/homelab1025/trippy-planner-frontend`)

- [ ] **Step 2: Verify the YAML syntax**

```bash
node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('.github/workflows/build.yml', 'utf8')); console.log('YAML is valid')"
```

If `yaml` module isn't available, just verify the file looks correct visually.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "ci: build and push both frontend and backend images to GHCR

- Unit tests and E2E tests run against frontend/
- Frontend image: <repo>-frontend (from frontend/Dockerfile)
- Backend image: <repo>-backend (from backend/Dockerfile)
- Both tagged with <version> and latest
- Version read from frontend/package.json"
```

### Task 2: Update K8s base deployments to reference GHCR images

**Files:**
- Modify: `k8s/base/deployment.yaml`
- Modify: `k8s/base/backend-deployment.yaml`

**Interfaces:**
- Consumes: GHCR image names `ghcr.io/homelab1025/trippy-planner-frontend` and `ghcr.io/homelab1025/trippy-planner-backend`
- Produces: K8s deployments referencing GHCR images with `imagePullPolicy: Always`

- [ ] **Step 1: Update frontend deployment**

Replace `image: trippy-planner:latest` with `image: ghcr.io/homelab1025/trippy-planner-frontend:latest`:

```yaml
          containers:
          - name: trippy-planner
            image: ghcr.io/homelab1025/trippy-planner-frontend:latest
            imagePullPolicy: Always
```

- [ ] **Step 2: Update backend deployment**

Replace `image: trippy-backend:latest` with `image: ghcr.io/homelab1025/trippy-planner-backend:latest`:

```yaml
        - name: trippy-backend
          image: ghcr.io/homelab1025/trippy-planner-backend:latest
          imagePullPolicy: Always
```

- [ ] **Step 3: Commit**

```bash
git add k8s/base/deployment.yaml k8s/base/backend-deployment.yaml
git commit -m "k8s: reference GHCR images in base deployments

- Frontend: ghcr.io/homelab1025/trippy-planner-frontend:latest
- Backend: ghcr.io/homelab1025/trippy-planner-backend:latest"
```

### Task 3: Update prod overlay to patch both images

**Files:**
- Modify: `k8s/overlays/prod/kustomization.yaml`

**Interfaces:**
- Consumes: base image names from Task 2
- Produces: Prod overlay that patches both image names to the correct GHCR paths (they're already correct, so this just patches the tag)

- [ ] **Step 1: Update prod kustomization.yaml**

The prod overlay currently only patches the frontend image. Update it to patch both:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: trippy-planner

resources:
- ../../base

images:
- name: ghcr.io/homelab1025/trippy-planner-frontend
  newName: ghcr.io/homelab1025/trippy-planner-frontend
  newTag: latest
- name: ghcr.io/homelab1025/trippy-planner-backend
  newName: ghcr.io/homelab1025/trippy-planner-backend
  newTag: latest
```

Wait — since the base already has the full GHCR path, the prod overlay just needs to ensure the tag is `latest` (which it already is in base). The `newName` would be the same as `name`, so we can simplify. But if prod is meant to use a different tag (e.g., a specific commit hash), we keep the structure. For now, since base already has `:latest`, the prod overlay can be simplified to just ensure the tag:

Actually, looking at it again — since base already has the full GHCR path with `:latest`, the prod overlay's `images` section is now redundant for the frontend (same name, same tag). But it's still needed for the backend. Let's keep both for symmetry and future-proofing:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: trippy-planner

resources:
- ../../base

images:
- name: ghcr.io/homelab1025/trippy-planner-frontend
  newName: ghcr.io/homelab1025/trippy-planner-frontend
  newTag: latest
- name: ghcr.io/homelab1025/trippy-planner-backend
  newName: ghcr.io/homelab1025/trippy-planner-backend
  newTag: latest
```

- [ ] **Step 2: Commit**

```bash
git add k8s/overlays/prod/kustomization.yaml
git commit -m "k8s: update prod overlay for both frontend and backend GHCR images"
```

### Task 4: Update release.yml to build both images

**Files:**
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: same as build.yml
- Produces: Release workflow that builds both images and pushes both

- [ ] **Step 1: Update release.yml**

Replace the single `docker/build-push-action` step with two steps (frontend + backend), mirroring build.yml:

```yaml
      - name: Build and push frontend image
        uses: docker/build-push-action@v7
        with:
          context: frontend
          file: frontend/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:${{ steps.versions.outputs.release }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:latest

      - name: Build and push backend image
        uses: docker/build-push-action@v7
        with:
          context: backend
          file: backend/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:${{ steps.versions.outputs.release }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:latest
```

Also fix the unit test and E2E test steps to use `frontend/` as the workdir:

```yaml
      - name: Run unit tests
        run: |
          docker run --rm \
            --user $(id -u):$(id -g) \
            --env HOME=/tmp \
            -v "${{ github.workspace }}:/app" \
            -w /app/frontend \
            node:24-alpine \
            sh -c "npm ci && npx vitest run"

      - name: Run E2E tests
        run: |
          docker run --rm \
            --user $(id -u):$(id -g) \
            --env HOME=/tmp \
            --ipc=host \
            --security-opt seccomp=unconfined \
            -v "${{ github.workspace }}:/app" \
            -w /app/frontend \
            mcr.microsoft.com/playwright:v1.60.0-noble \
            sh -c "npm ci && npx playwright test"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: build both images in release workflow

- Frontend: <repo>-frontend (from frontend/Dockerfile)
- Backend: <repo>-backend (from backend/Dockerfile)
- Both tagged with release version and latest"
```

### Task 5: Verify end-to-end

**Files:**
- Verify: `.github/workflows/build.yml`
- Verify: `.github/workflows/release.yml`
- Verify: `k8s/base/deployment.yaml`
- Verify: `k8s/base/backend-deployment.yaml`
- Verify: `k8s/overlays/prod/kustomization.yaml`

**Interfaces:**
- Consumes: all changed files
- Produces: Confidence that the pipeline is correct

- [ ] **Step 1: Check no references to old local image names remain**

```bash
grep -r "trippy-backend:latest\|trippy-planner:latest" --include="*.yaml" --include="*.yml" k8s/ .github/
```

Expected: No matches (old local names removed from all K8s files).

- [ ] **Step 2: Verify all K8s files reference correct GHCR names**

```bash
grep -r "ghcr.io/homelab1025/trippy-planner" --include="*.yaml" k8s/
```

Expected: Matches in `base/deployment.yaml`, `base/backend-deployment.yaml`, and `overlays/prod/kustomization.yaml`.

- [ ] **Step 3: Verify workflow files have correct contexts**

```bash
grep -A2 "context:" .github/workflows/build.yml .github/workflows/release.yml
```

Expected: `context: frontend` for frontend build, `context: backend` for backend build.

- [ ] **Step 4: Final commit (if needed)**

```bash
git add -A
git commit -m "verify: GHCR image build pipeline end-to-end"
```
