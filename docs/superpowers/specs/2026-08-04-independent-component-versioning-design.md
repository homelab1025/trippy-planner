# Independent frontend/backend versioning and release workflows

## Problem

The `Release` GitHub Actions workflow (`.github/workflows/release.yml`) fails immediately:

```
npm error enoent ENOENT: no such file or directory, open '.../trippy-planner/package.json'
```

Root cause: the "Set release version in package.json" step runs `npm version ... --no-git-tag-version` from the repo root, but `package.json` lives in `frontend/`. The step is missing `working-directory: frontend`.

Investigating this surfaced a broader inconsistency: `backend/pom.xml` has its own independent version (`1.0.0-SNAPSHOT`) that no workflow has ever bumped, while `release.yml` derives a single version from `frontend/package.json` and uses it to tag *both* the frontend and backend Docker images. The same coupling exists in `.github/workflows/build.yml` (the on-push-to-master build), which computes one version from `package.json` and tags both images with it. Backend's actual version has simply never been reflected anywhere it's used.

## Decision

Rather than patch the one broken step, or unify frontend/backend under one shared version, we're moving to **fully independent versioning**: `package.json` and `pom.xml` each remain the authoritative version for their own component, bumped independently, released independently, via two separate GitHub Actions workflows. This matches how the two components are already deployed — both `k8s/base/deployment.yaml` and `k8s/base/backend-deployment.yaml` track `:latest`, so nothing downstream requires frontend and backend to share a release cadence or a version number today.

Alternatives considered and rejected:
- **Shared root `VERSION` file** consumed read-only by both builds (via a Maven `${revision}`/flatten-maven-plugin setup and a `vite.config.ts` file read). Rejected because it invents a third numbering scheme neither tool natively wants, requires extra Maven plugin machinery, and provides no benefit here since nothing currently treats "the app version" as a single cross-component concept.
- **One release workflow bumping both components every run.** Rejected because it forces a frontend release (and image push) any time you only wanted to ship a backend fix, defeating the purpose of independent version numbers.

## Design

### Versioning
- `frontend/package.json` — frontend semver, bumped via `npm version`, currently `2.5.0-SNAPSHOT`.
- `backend/pom.xml` — backend semver, bumped via `mvn versions:set`, currently `1.0.0-SNAPSHOT`.
- Each follows the existing SNAPSHOT convention: release value has no suffix; immediately after release, the workflow bumps to the next `-SNAPSHOT` per a `bump_type` input (major/minor/patch).
- Git tags are component-prefixed to avoid ambiguity: `frontend-v2.6.0`, `backend-v1.1.0`.
- Docker image tags: `${REGISTRY}/${IMAGE_NAME}-frontend:<version>` / `-backend:<version>`, plus `:latest` — unchanged pattern, just sourced from the correct component's version.

### Workflows
Replace `.github/workflows/release.yml` with two independent workflows, each `workflow_dispatch`-triggered with a `bump_type` input:

- **`release-frontend.yml`** — reads current version via `node -p "require('./frontend/package.json').version"`, runs `make test-frontend` + `make e2e-test`, then delegates to the shared composite action.
- **`release-backend.yml`** — reads current version via `./mvnw -q help:evaluate -Dexpression=project.version -DforceStdout`, runs `make test-backend` + `make e2e-test`, then delegates to the shared composite action.

Both run the full E2E suite (`make e2e-test` boots the whole compose stack regardless of which component is releasing) — a `release-backend` run therefore tests the newly-bumped backend against whatever frontend is currently on `master`, and vice versa. This is accepted as consistent with the `:latest`-based deployment model: the two components already float independently in production.

### Shared release logic: composite action, not reusable workflow
A GitHub Actions *reusable workflow* (`workflow_call`) runs as a separate job on a fresh runner and does not share the calling job's filesystem/git state. This flow needs the version bump, tests, Docker build, and commit+tag to all observe the same mutated working tree in sequence, so the shared logic must be a **composite action** (`.github/actions/release-image/action.yml`), which runs as steps inside the caller's job.

Inputs: `component` (`frontend`|`backend`), `release_version`, `next_version`, `bump_release_cmd`, `bump_next_cmd`, `version_file_paths` (for `git add`), `dockerfile`, `docker_context`, `image_suffix`.

Steps: docker login → `docker/build-push-action@v7` (build + push, tagged `<release_version>` and `latest`) → commit release version bump + annotated tag `<component>-v<release_version>` → bump to next `-SNAPSHOT` → commit → push commits and tag.

The workflow intentionally does **not** call `make build` / `make build-frontend` / `make build-backend` before pushing — today's `release.yml` does this and it's wasted work: `make build` produces local `trippy-frontend:latest` / `trippy-backend:latest` images that are immediately discarded once `docker/build-push-action@v7` does its own build for the actual push. The Makefile's `build*` targets remain unchanged for local dev use; they're just not invoked from the release path.

### Other required fixes
- **`build.yml`** — split the single "Set Release Version" step (currently reads only `frontend/package.json`) into two independent reads, one per component, so each image is tagged with its own component's version instead of both being tagged with the frontend's.
- **`backend/pom.xml`** — add `<finalName>backend</finalName>` under `<build>`. Without this, `backend/Dockerfile`'s hardcoded `COPY --from=build /app/target/backend-1.0.0-SNAPSHOT.jar app.jar` breaks the first time `pom.xml`'s version is ever bumped (which `release-backend.yml` will now do — previously nothing did).
- **`backend/Dockerfile`** — update the `COPY` line to `COPY --from=build /app/target/backend.jar app.jar`.

## Testing
- Unit tests: `make test-frontend` (in `release-frontend.yml`) / `make test-backend` (in `release-backend.yml`), scoped to the component being released.
- E2E: `make e2e-test` in both workflows, full-stack, run after the version bump so it exercises the real release version.
- Manual verification of the composite action and both workflows happens via a `workflow_dispatch` run on this branch before merging (self-hosted runner required — cannot be fully exercised from a local sandbox).
