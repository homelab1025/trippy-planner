# Independent Component Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken, coupled `release.yml` with two independent release workflows (frontend, backend), each versioning and releasing its own component via a shared composite action, and fix the backend Docker build's version-hardcoding so it survives a version bump.

**Architecture:** `frontend/package.json` and `backend/pom.xml` remain each component's own authoritative version, bumped and tagged independently. A new composite action `.github/actions/release-image/action.yml` holds the steps common to both releases (docker build/push, commit release version, tag, commit next SNAPSHOT, push) and runs inside the caller's job so it shares the job's git/filesystem state. Two thin `workflow_dispatch` workflows compute their component's version and invoke the composite action. `build.yml`'s on-push image tagging is split so each image is tagged from its own component's version instead of both from `frontend/package.json`.

**Tech Stack:** GitHub Actions (composite actions, `workflow_dispatch`), npm (`npm version`), Maven (`mvn versions:set`, `mvn help:evaluate`), Docker (`docker/build-push-action@v7`), self-hosted GitHub Actions runner.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-04-independent-component-versioning-design.md`
- Git tags: component-prefixed — `frontend-v<version>`, `backend-v<version>` (spec "Versioning")
- Docker image tags: `${REGISTRY}/${IMAGE_NAME}-frontend:<version>` / `-backend:<version>`, plus `:latest` (spec "Versioning")
- Release workflows must NOT call `make build` / `make build-frontend` / `make build-backend` — use `docker/build-push-action@v7` directly (spec "Shared release logic")
- Shared release steps live in a composite action, not a reusable workflow (spec "Shared release logic" — reusable workflows don't share job filesystem state)
- SNAPSHOT convention preserved: release value has no suffix; workflow bumps to next `-SNAPSHOT` per a `bump_type` input (major/minor/patch) immediately after release (spec "Versioning")

---

## File Structure

- **Modify** `backend/pom.xml` — add `<finalName>backend</finalName>` so the built jar has a version-independent name.
- **Modify** `backend/Dockerfile` — copy the fixed `backend.jar` name instead of the version-embedded one.
- **Create** `.github/actions/release-image/action.yml` — composite action: docker build+push, commit+tag release version, bump+commit next SNAPSHOT, push. Shared by both release workflows.
- **Create** `.github/workflows/release-frontend.yml` — computes frontend version, runs frontend tests, invokes the composite action.
- **Create** `.github/workflows/release-backend.yml` — computes backend version, runs backend tests, invokes the composite action.
- **Delete** `.github/workflows/release.yml` — superseded by the two workflows above.
- **Modify** `.github/workflows/build.yml` — split the single version read into two independent per-component reads for image tagging.

---

### Task 1: Decouple the backend jar filename from its version

**Files:**
- Modify: `backend/pom.xml:116-125` (the existing `<build><plugins>` block)
- Modify: `backend/Dockerfile:13`

**Interfaces:**
- Produces: a Maven build that always emits `backend/target/backend.jar` regardless of `<version>` in `pom.xml`. Later tasks (composite action, `release-backend.yml`) don't need to know the jar's version-suffixed name.

- [ ] **Step 1: Add `<finalName>` to `pom.xml`**

Open `backend/pom.xml` and find the `<build>` block starting at line 116:

```xml
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <configuration>
```

Add a `<finalName>` element directly under `<build>`, before `<plugins>`:

```xml
    <build>
        <finalName>backend</finalName>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <configuration>
```

- [ ] **Step 2: Build the jar and verify the filename**

Run: `cd backend && ./mvnw -q package -DskipTests`
Expected: `backend/target/backend.jar` exists (not `backend/target/backend-1.0.0-SNAPSHOT.jar`).

Verify: `ls backend/target/backend.jar`

- [ ] **Step 3: Update the Dockerfile to copy the fixed filename**

In `backend/Dockerfile`, change:

```dockerfile
COPY --from=build /app/target/backend-1.0.0-SNAPSHOT.jar app.jar
```

to:

```dockerfile
COPY --from=build /app/target/backend.jar app.jar
```

- [ ] **Step 4: Build the Docker image and verify it runs**

Run: `docker build -t trippy-backend-test:latest -f backend/Dockerfile .`
Expected: build succeeds (no "file not found" on the COPY line).

Run: `docker run --rm trippy-backend-test:latest --spring.main.lazy-initialization=true &` then check the container starts without an immediate crash (e.g. `docker logs` shows Spring Boot starting, not a "jar not found" or class-not-found error), then stop it. If a full run requires a database/env vars it doesn't have in this ad-hoc check, it's sufficient that the JVM starts and gets as far as attempting Spring context startup — that confirms the jar was copied and is runnable, which is what this task is fixing.

- [ ] **Step 5: Commit**

```bash
git add backend/pom.xml backend/Dockerfile
git commit -m "fix(backend): decouple jar filename from pom.xml version"
```

---

### Task 2: Create the shared composite action

**Files:**
- Create: `.github/actions/release-image/action.yml`

**Interfaces:**
- Consumes (action inputs, provided by caller workflows built in Tasks 3-4):
  - `component` (string: `frontend` or `backend`)
  - `release_version` (string, e.g. `2.6.0`)
  - `next_version` (string, e.g. `2.7.0-SNAPSHOT`)
  - `bump_release_cmd` (string, shell command that mutates the version file to `release_version`, run from repo root)
  - `bump_next_cmd` (string, shell command that mutates the version file to `next_version`, run from repo root)
  - `version_file_paths` (string, newline- or space-separated paths passed to `git add`)
  - `dockerfile` (string, path to Dockerfile)
  - `docker_context` (string, Docker build context path)
  - `image_suffix` (string, e.g. `frontend` or `backend` — used in the image name)
  - `registry` (string)
  - `image_name` (string, e.g. `${{ github.repository }}`)
  - `github_token` (string, for docker login and git push — passed as `secrets.GITHUB_TOKEN` by caller)
- Produces: nothing consumed by later tasks (this is the leaf of the dependency chain) — it performs the release side effects (pushed image, commit, tag, push).

Composite actions cannot commit/push using the checkout token unless the caller's checkout step used a token with write permission and the composite action runs `git push` in the same job — this matches how `release.yml` already works today (checkout uses `secrets.GITHUB_TOKEN`), so no new permission wiring is needed beyond what Tasks 3-4's workflows set up.

- [ ] **Step 1: Create the action directory and file**

Create `.github/actions/release-image/action.yml`:

```yaml
name: 'Release component image'
description: 'Bump a component version, run docker build+push, and commit the release + next-SNAPSHOT versions'

inputs:
  component:
    required: true
    description: 'frontend or backend'
  release_version:
    required: true
  next_version:
    required: true
  bump_release_cmd:
    required: true
    description: 'Shell command (run from repo root) that sets the version file to release_version'
  bump_next_cmd:
    required: true
    description: 'Shell command (run from repo root) that sets the version file to next_version'
  version_file_paths:
    required: true
    description: 'Space-separated paths to git add after each bump'
  dockerfile:
    required: true
  docker_context:
    required: true
  image_suffix:
    required: true
  registry:
    required: true
  image_name:
    required: true
  github_token:
    required: true

runs:
  using: 'composite'
  steps:
    - name: Bump to release version
      shell: bash
      run: ${{ inputs.bump_release_cmd }}

    - name: Log in to the Container registry
      uses: docker/login-action@v4
      with:
        registry: ${{ inputs.registry }}
        username: ${{ github.actor }}
        password: ${{ inputs.github_token }}

    - name: Build and push image
      uses: docker/build-push-action@v7
      with:
        context: ${{ inputs.docker_context }}
        file: ${{ inputs.dockerfile }}
        push: true
        tags: |
          ${{ inputs.registry }}/${{ inputs.image_name }}-${{ inputs.image_suffix }}:${{ inputs.release_version }}
          ${{ inputs.registry }}/${{ inputs.image_name }}-${{ inputs.image_suffix }}:latest

    - name: Commit release version and tag
      shell: bash
      run: |
        git add ${{ inputs.version_file_paths }}
        git commit -m "chore(${{ inputs.component }}): release v${{ inputs.release_version }}"
        git tag -a "${{ inputs.component }}-v${{ inputs.release_version }}" -m "Release ${{ inputs.component }} v${{ inputs.release_version }}"

    - name: Bump to next SNAPSHOT
      shell: bash
      run: ${{ inputs.bump_next_cmd }}

    - name: Commit next development version
      shell: bash
      run: |
        git add ${{ inputs.version_file_paths }}
        git commit -m "chore(${{ inputs.component }}): prepare for next development iteration ${{ inputs.next_version }}"

    - name: Push commits and tag
      shell: bash
      run: git push origin HEAD "${{ inputs.component }}-v${{ inputs.release_version }}"
```

- [ ] **Step 2: Validate YAML syntax**

Run: `ruby -ryaml -e "YAML.load_file('.github/actions/release-image/action.yml'); puts 'valid'"`
Expected: `valid` (no exception). If it raises, fix the reported line/column.

- [ ] **Step 3: Commit**

```bash
git add .github/actions/release-image/action.yml
git commit -m "feat(ci): add shared release-image composite action"
```

---

### Task 3: Create `release-frontend.yml`

**Files:**
- Create: `.github/workflows/release-frontend.yml`

**Interfaces:**
- Consumes: `.github/actions/release-image/action.yml` (Task 2) via `uses: ./.github/actions/release-image`, passing frontend-specific inputs.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Create the workflow file**

The bump happens once, here in the caller, before tests run (so tests and the image build exercise the real release version). The composite action's `bump_release_cmd` is passed `"true"` (a shell no-op) since the bump is already done by the time the composite action runs — it only needs to perform the *next*-SNAPSHOT bump itself.

```yaml
name: Release Frontend

on:
  workflow_dispatch:
    inputs:
      bump_type:
        description: 'Version component to bump for next development cycle'
        required: true
        default: minor
        type: choice
        options: [major, minor, patch]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  release:
    runs-on: self-hosted
    permissions:
      contents: write
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

      - name: Compute versions
        id: versions
        run: |
          CURRENT=$(node -p "require('./frontend/package.json').version")
          if [[ "$CURRENT" != *-SNAPSHOT ]]; then
            echo "ERROR: Expected a SNAPSHOT version, got: $CURRENT" && exit 1
          fi
          RELEASE=${CURRENT%-SNAPSHOT}
          IFS='.' read -r MAJOR MINOR PATCH <<< "$RELEASE"
          case "${{ inputs.bump_type }}" in
            major) NEXT="$((MAJOR+1)).0.0-SNAPSHOT" ;;
            minor) NEXT="${MAJOR}.$((MINOR+1)).0-SNAPSHOT" ;;
            patch) NEXT="${MAJOR}.${MINOR}.$((PATCH+1))-SNAPSHOT" ;;
          esac
          echo "release=$RELEASE" >> $GITHUB_OUTPUT
          echo "next=$NEXT" >> $GITHUB_OUTPUT
        shell: bash

      - name: Set release version in package.json
        working-directory: frontend
        run: npm version ${{ steps.versions.outputs.release }} --no-git-tag-version
        shell: bash

      - name: Run unit tests
        run: make test-frontend

      - name: Run E2E tests
        run: make e2e-test

      - name: Release frontend image
        uses: ./.github/actions/release-image
        with:
          component: frontend
          release_version: ${{ steps.versions.outputs.release }}
          next_version: ${{ steps.versions.outputs.next }}
          bump_release_cmd: "true"
          bump_next_cmd: cd frontend && npm version ${{ steps.versions.outputs.next }} --no-git-tag-version --allow-same-version
          version_file_paths: frontend/package.json frontend/package-lock.json
          dockerfile: frontend/Dockerfile
          docker_context: frontend
          image_suffix: frontend
          registry: ${{ env.REGISTRY }}
          image_name: ${{ env.IMAGE_NAME }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Validate YAML syntax**

Run: `ruby -ryaml -e "YAML.load_file('.github/workflows/release-frontend.yml'); puts 'valid'"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release-frontend.yml
git commit -m "feat(ci): add release-frontend workflow"
```

---

### Task 4: Create `release-backend.yml`

**Files:**
- Create: `.github/workflows/release-backend.yml`

**Interfaces:**
- Consumes: `.github/actions/release-image/action.yml` (Task 2), same as Task 3 but backend-specific inputs. Relies on Task 1's `<finalName>backend</finalName>` so the Docker build inside the composite action's `docker/build-push-action@v7` step succeeds regardless of the bumped version.

- [ ] **Step 1: Create the workflow file**

```yaml
name: Release Backend

on:
  workflow_dispatch:
    inputs:
      bump_type:
        description: 'Version component to bump for next development cycle'
        required: true
        default: minor
        type: choice
        options: [major, minor, patch]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  release:
    runs-on: self-hosted
    permissions:
      contents: write
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

      - name: Compute versions
        id: versions
        working-directory: backend
        run: |
          CURRENT=$(./mvnw -q help:evaluate -Dexpression=project.version -DforceStdout)
          if [[ "$CURRENT" != *-SNAPSHOT ]]; then
            echo "ERROR: Expected a SNAPSHOT version, got: $CURRENT" && exit 1
          fi
          RELEASE=${CURRENT%-SNAPSHOT}
          IFS='.' read -r MAJOR MINOR PATCH <<< "$RELEASE"
          case "${{ inputs.bump_type }}" in
            major) NEXT="$((MAJOR+1)).0.0-SNAPSHOT" ;;
            minor) NEXT="${MAJOR}.$((MINOR+1)).0-SNAPSHOT" ;;
            patch) NEXT="${MAJOR}.${MINOR}.$((PATCH+1))-SNAPSHOT" ;;
          esac
          echo "release=$RELEASE" >> $GITHUB_OUTPUT
          echo "next=$NEXT" >> $GITHUB_OUTPUT
        shell: bash

      - name: Set release version in pom.xml
        working-directory: backend
        run: ./mvnw -q versions:set -DnewVersion=${{ steps.versions.outputs.release }} -DgenerateBackupPoms=false
        shell: bash

      - name: Run unit tests
        run: make test-backend

      - name: Run E2E tests
        run: make e2e-test

      - name: Release backend image
        uses: ./.github/actions/release-image
        with:
          component: backend
          release_version: ${{ steps.versions.outputs.release }}
          next_version: ${{ steps.versions.outputs.next }}
          bump_release_cmd: "true"
          bump_next_cmd: cd backend && ./mvnw -q versions:set -DnewVersion=${{ steps.versions.outputs.next }} -DgenerateBackupPoms=false
          version_file_paths: backend/pom.xml
          dockerfile: backend/Dockerfile
          docker_context: .
          image_suffix: backend
          registry: ${{ env.REGISTRY }}
          image_name: ${{ env.IMAGE_NAME }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

Note `docker_context: .` (repo root) matches the existing backend Dockerfile, which does `COPY backend/.mvn/ .mvn/` etc. from repo root context — same as today's `release.yml` backend push step.

- [ ] **Step 2: Validate YAML syntax**

Run: `ruby -ryaml -e "YAML.load_file('.github/workflows/release-backend.yml'); puts 'valid'"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release-backend.yml
git commit -m "feat(ci): add release-backend workflow"
```

---

### Task 5: Remove the old combined release workflow

**Files:**
- Delete: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: confirmation that Tasks 3-4 fully replace this workflow's functionality (frontend release + backend release, both producing tagged Docker images).

- [ ] **Step 1: Delete the file**

```bash
git rm .github/workflows/release.yml
```

- [ ] **Step 2: Confirm no other file references it**

Run: `grep -rn "release.yml" --include="*.yml" --include="*.yaml" --include="*.md" . 2>/dev/null | grep -v node_modules | grep -v "/target/"`
Expected: no results referencing `.github/workflows/release.yml` (aside from this plan/spec's own prose, which are `.md` files describing the change, not functional references — if the grep flags this plan or the spec file, that's expected and fine).

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(ci): remove combined release workflow, superseded by release-frontend/release-backend"
```

---

### Task 6: Fix `build.yml`'s coupled version tagging

**Files:**
- Modify: `.github/workflows/build.yml:32-38` (the "Set Release Version" step) and the two `docker/build-push-action@v7` steps that follow it.

**Interfaces:**
- Consumes: nothing from earlier tasks (independent fix, same root-cause pattern as Tasks 3-4 but for the on-push build path instead of the release path).

- [ ] **Step 1: Replace the single version-read step with two**

In `.github/workflows/build.yml`, find:

```yaml
      - name: Set Release Version
        id: set_version
        run: |
          VERSION=$(node -p "require('./frontend/package.json').version")
          echo "version=$VERSION" >> $GITHUB_OUTPUT
        shell: bash
```

Replace with:

```yaml
      - name: Set frontend version
        id: frontend_version
        run: |
          VERSION=$(node -p "require('./frontend/package.json').version")
          echo "version=$VERSION" >> $GITHUB_OUTPUT
        shell: bash

      - name: Set backend version
        id: backend_version
        working-directory: backend
        run: |
          VERSION=$(./mvnw -q help:evaluate -Dexpression=project.version -DforceStdout)
          echo "version=$VERSION" >> $GITHUB_OUTPUT
        shell: bash
```

- [ ] **Step 2: Point each image's tags at its own version output**

Find the "Push frontend image" step's `tags:` block:

```yaml
        tags: |
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:${{ steps.set_version.outputs.version }}
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:latest
```

Change `steps.set_version.outputs.version` to `steps.frontend_version.outputs.version`.

Find the "Push backend image" step's `tags:` block:

```yaml
        tags: |
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:${{ steps.set_version.outputs.version }}
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:latest
```

Change `steps.set_version.outputs.version` to `steps.backend_version.outputs.version`.

- [ ] **Step 3: Validate YAML syntax**

Run: `ruby -ryaml -e "YAML.load_file('.github/workflows/build.yml'); puts 'valid'"`
Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "fix(ci): tag frontend/backend images with their own component version"
```

---

### Task 7: Push branch and open PR

**Files:** none (git/gh operations only)

**Interfaces:** none — final task.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin ci/independent-component-versioning
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "ci: independent frontend/backend versioning and release workflows" --body "$(cat <<'EOF'
## Summary
- Fixes the failing Release workflow (npm version ran from repo root instead of frontend/)
- Replaces the single coupled release.yml with independent release-frontend.yml / release-backend.yml, each versioning and releasing its own component via a shared composite action
- Fixes build.yml tagging both images from frontend's version only
- Decouples backend's Docker build from its pom.xml version (fixed jar finalName)

## Test plan
- [ ] `ruby -ryaml` syntax validation passed for all new/changed workflow files (done locally)
- [ ] `./mvnw -q package -DskipTests` produces `backend/target/backend.jar` (done locally)
- [ ] `docker build -f backend/Dockerfile .` succeeds with the fixed jar name (done locally)
- [ ] Trigger `release-frontend.yml` via workflow_dispatch on this branch and confirm it bumps, tests, builds, pushes, tags, and commits correctly
- [ ] Trigger `release-backend.yml` via workflow_dispatch on this branch and confirm the same

Design spec: docs/superpowers/specs/2026-08-04-independent-component-versioning-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Mark the spec as viewed on the PR** (per project CLAUDE.md)

```bash
PR_NUMBER=$(gh pr view --json number -q .number)
PR_ID=$(gh pr view "$PR_NUMBER" --json id -q .id)
gh api graphql -f query="
  mutation {
    markFileAsViewed(input: {pullRequestId: \"$PR_ID\", path: \"docs/superpowers/specs/2026-08-04-independent-component-versioning-design.md\"}) {
      pullRequest { number }
    }
  }
"
```

- [ ] **Step 4: Report the PR URL to the user**

The two `workflow_dispatch` test-plan checkboxes in the PR body require a self-hosted runner and real registry credentials — they can't be exercised from this sandbox. Tell the user the PR is open and that triggering both release workflows manually (`gh workflow run release-frontend.yml`, `gh workflow run release-backend.yml`) is the remaining verification step before merge.

---

## Self-Review Notes

- **Spec coverage:** Versioning (Task 3/4 compute+bump), git tags (composite action tag step), Docker tags (composite action build-push step), workflows replacing release.yml (Tasks 3-5), composite-action-not-reusable-workflow (Task 2), no `make build` in release path (Tasks 3-4 never call it), build.yml fix (Task 6), pom.xml finalName + Dockerfile (Task 1) — all covered.
- **Placeholder scan:** no TBD/TODO; every step has literal file content or exact commands.
- **Type/name consistency:** composite action input names (`component`, `release_version`, `next_version`, `bump_release_cmd`, `bump_next_cmd`, `version_file_paths`, `dockerfile`, `docker_context`, `image_suffix`, `registry`, `image_name`, `github_token`) are identical across Task 2's definition and Tasks 3/4's `with:` blocks.
- **Fixed during self-review:** the composite action (Task 2) originally had a duplicate `shell: bash` key on one step (invalid YAML) — removed. `release-frontend.yml` (Task 3) originally bumped the version twice (once in the caller, once redundantly in the composite action, with a reset step in between) — simplified so the caller bumps once before tests run and passes `bump_release_cmd: "true"` (no-op) to the composite action, which only performs the next-SNAPSHOT bump. Both fixes are reflected directly in the task content above, not left as narration.
