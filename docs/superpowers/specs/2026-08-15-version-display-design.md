# Backend version display + pinned prod release versions

## Problem

The Tech Details panel shows only the frontend version (`v{__APP_VERSION__}`), and it's often wrong in prod: it shows a `-SNAPSHOT` version instead of the version that was actually released.

Root cause: `k8s/overlays/prod/kustomization.yaml` pins both images to the `:latest` tag, and `.github/workflows/build.yml` pushes `:latest` on *every* push to `master` — including the release workflow's own automatic "prepare for next development iteration" commit, which bumps `package.json`/`pom.xml` back to a `-SNAPSHOT` version immediately after release. That push retriggers `build.yml`, which rebuilds and overwrites `:latest` with an image baked from the SNAPSHOT version. Since prod uses `imagePullPolicy: Always` and deploys are a manual `kubectl apply -k k8s/overlays/prod`, prod ends up serving the SNAPSHOT-versioned build shortly after every release.

Separately, the panel has never shown a backend version at all — there's no endpoint exposing it.

## Decision

Two independent fixes:

1. **Pin `k8s/overlays/prod/kustomization.yaml` to explicit per-component release versions**, updated automatically as part of each release, instead of tracking the mutable `:latest` tag.
2. **Add a public `GET /version` backend endpoint** and display its result under the existing frontend version line in the Tech Details panel.

### Alternatives considered and rejected

- **Stop `build.yml` from pushing `:latest` on regular master pushes.** Closes today's specific trigger (the release-bot's own follow-up commit) but not the bug class: any future workflow that pushes to master could reopen the same failure mode. Pinning removes the dependency on `:latest` entirely.
- **Separate deployment-manifests repo (GitOps style).** Only pays off if a reconciler (ArgoCD/Flux) is watching git and auto-applying — confirmed there isn't one; deploys are a manual `kubectl apply` today. Without a reconciler, a second repo is a repo to keep in sync by hand plus a cross-repo token, with no auto-sync benefit. Revisit if/when a GitOps controller is introduced.
- **Spring Boot Actuator `/actuator/info`** instead of a custom endpoint. Less code (just the `build-info` goal + endpoint exposure), but actuator paths in this app are host-restricted in `SecurityFilter` for infra reasons (`ACTUATOR_HEALTH_ALLOWED_HOSTS`), and reworking that restriction to make `/actuator/info` public site-wide conflates two different access-control concerns. A custom OpenAPI-defined endpoint also fits the project's existing pattern (frontend calls everything through the generated Axios client) where actuator would not.
- **Version-only payload (no build timestamp).** Rejected in favor of `{ version, buildTime }` so the backend line can mirror the frontend's existing `vX.Y.Z` + build-date display.

## Design

### 1. Pinned prod release versions

- `k8s/overlays/prod/kustomization.yaml`: the two `images[].newTag` values change from `latest` to real version strings (e.g. `3.2.0`, `2.2.0`).
- `.github/actions/release-image/action.yml`'s existing "Commit release version and tag" step gets one more edit before it commits: rewrite only the `newTag` line for the `images[]` entry matching `inputs.component` (frontend or backend release independently, so only one entry changes per run — matched by its `name:` line, since both entries share the same 3-line shape but different image names).
- `k8s/base/*-deployment.yaml` (`imagePullPolicy: Always`) is unchanged — harmless with pinned immutable-per-release tags, and not part of this problem.
- `.github/workflows/build.yml` is unchanged. It keeps pushing `:latest` on every master push; nothing reads that tag anymore, so it becomes an inert-but-harmless "latest master build" artifact, useful only for manual ad hoc pulls if ever needed.

### 2. Backend `GET /version`

- `openapi.yaml`: new `version` tag, `GET /version`, no `security` requirement, response body:
  ```yaml
  version:
    type: string
  buildTime:
    type: string
    format: date-time
  ```
- `backend/pom.xml`: add the `build-info` goal to the existing `spring-boot-maven-plugin` `<execution>`. This generates `target/classes/META-INF/build-info.properties` at build time, which Spring Boot auto-detects to populate the `BuildProperties` bean (`getVersion()`, `getTime()`) — no new dependency.
- New `VersionController` (in `com.trippyplanner`, alongside the other controllers) implementing the generated `VersionApi` interface, injecting `BuildProperties` and mapping `version`/`time` to the response DTO.
- `SecurityFilter.PUBLIC_PATHS`: add `/version`. It must be reachable without a Bearer token — the Tech Details panel is visible to signed-out visitors.

### 3. Frontend display

- Regenerating the API client (`npm run generate:api`) produces a `VersionApi` class from the new OpenAPI path.
- `frontend/src/apiClient.ts`: export `versionApi = new VersionApi(undefined, undefined, axiosInstance)`, alongside `authApi`/`routesApi`/`shareApi`.
- `frontend/src/App.tsx`:
  - New state: `const [backendVersion, setBackendVersion] = useState<{ version: string; buildTime: string } | null>(null)`.
  - Fetched once on mount, in the existing "runs once on mount" `useEffect` (same one that calls `authApi.getMe()`): `versionApi.getVersion().then(res => setBackendVersion(res.data)).catch(() => setBackendVersion(null))`.
  - On fetch failure, `backendVersion` stays `null` and no backend version line is rendered — no synthetic fallback, consistent with how failed weather lookups are already handled in this codebase (`null` per point, "unavailable" messaging, no mock data).
  - Render, directly under the existing frontend version block in the Tech Details panel:
    ```
    <div className="text-sm font-semibold">v{__APP_VERSION__}</div>
    <div className="text-xs text-base-content/50">{buildDate}</div>
    {backendVersion && (
      <>
        <div className="text-sm font-semibold">v{backendVersion.version}</div>
        <div className="text-xs text-base-content/50">
          {format(new Date(backendVersion.buildTime), 'd MMM yyyy HH:mm')}
        </div>
      </>
    )}
    ```

## Testing

- Backend: unit test for `VersionController` (inject a stub/mock `BuildProperties`, assert the mapped response); a `SecurityFilterTest` case asserting `GET /api/version` is reachable without a Bearer token.
- Frontend: `App.test.tsx` coverage for both the success render path (backend version line appears under the frontend one) and the failure path (no backend line, no crash) — mocking `versionApi.getVersion()`.
- CI/deploy pinning cannot be exercised locally (self-hosted runner only). Verified via an actual `workflow_dispatch` release run on this branch before merging, same caveat as the prior `2026-08-04-independent-component-versioning-design.md`.
