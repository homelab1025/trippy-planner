# Backend Version Display + Pinned Prod Release Versions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Tech Details panel showing a stale `-SNAPSHOT` frontend version in prod, and add a backend version line underneath it.

**Architecture:** Backend exposes a new public `GET /version` endpoint backed by Spring Boot's `BuildProperties` bean; the frontend fetches it once on mount and renders it under the existing frontend version line. Separately (and independently), prod's k8s overlay is pinned to explicit per-component release versions instead of the mutable `:latest` tag, with the release automation keeping that pin up to date going forward.

**Tech Stack:** Spring Boot (Java 25, Maven), OpenAPI-generated controller interfaces, React/TypeScript (Vite), openapi-generator `typescript-axios` client, GitHub Actions, Kustomize.

## Global Constraints

- Follow the language style guides in `contributing/styleguide/` for any Java/TypeScript written.
- `openapi.yaml` is the single source of truth — both the backend interfaces and the frontend client are generated from it; hand-write nothing that generation already produces.
- No synthetic/mock fallback data on fetch failure — mirror the existing weather-fetch convention (`null` on failure, nothing rendered, no fake data).
- Per-task commits happen locally on this isolated worktree branch as part of the SDD workflow (ledger + review loop depend on committed state). Nothing is pushed, and nothing reaches `master`, without separate explicit approval later.

---

## Task 1: Backend — public `GET /version` endpoint

**Files:**
- Modify: `openapi.yaml`
- Modify: `backend/pom.xml`
- Create: `backend/src/main/java/com/trippyplanner/version/VersionController.java`
- Create: `backend/src/test/java/com/trippyplanner/version/VersionControllerTest.java`
- Modify: `backend/src/main/java/com/trippyplanner/common/SecurityFilter.java`
- Modify: `backend/src/test/java/com/trippyplanner/common/SecurityFilterTest.java`

**Interfaces:**
- Produces (HTTP): `GET /api/version` → `200 { "version": "<semver>", "buildTime": "<ISO-8601 offset date-time>" }`, no `Authorization` header required.
- Produces (generated after `./mvnw generate-sources`, consumed by Task 1 only): interface `com.trippyplanner.api.VersionApi` with `ResponseEntity<VersionInfo> getVersion()`; model `com.trippyplanner.model.VersionInfo` with `getVersion()/setVersion(String)` and `getBuildTime()/setBuildTime(OffsetDateTime)`.

- [ ] **Step 1: Add the `VersionInfo` schema and `/version` path to `openapi.yaml`**

  In the `components.schemas` section, add (after `ShareResponse`, before the `paths:` line at 101):

  ```yaml
    VersionInfo:
      type: object
      required: [version, buildTime]
      properties:
        version:
          type: string
        buildTime:
          type: string
          format: date-time
  ```

  At the end of `paths:` (after the `/share/{shareToken}:` block), add:

  ```yaml
    /version:
      get:
        summary: Get backend build version
        tags: [version]
        operationId: getVersion
        responses:
          '200':
            description: Backend version info (no auth required)
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/VersionInfo'
  ```

  Note there is no `security:` key on this operation — same as `getSharedRoute`, this makes it public since the file has no top-level default `security:` requirement.

- [ ] **Step 2: Add the `build-info` goal to the Spring Boot Maven plugin**

  In `backend/pom.xml`, change:

  ```xml
              <plugin>
                  <groupId>org.springframework.boot</groupId>
                  <artifactId>spring-boot-maven-plugin</artifactId>
              </plugin>
  ```

  to:

  ```xml
              <plugin>
                  <groupId>org.springframework.boot</groupId>
                  <artifactId>spring-boot-maven-plugin</artifactId>
                  <executions>
                      <execution>
                          <goals>
                              <goal>build-info</goal>
                          </goals>
                      </execution>
                  </executions>
              </plugin>
  ```

  This generates `target/classes/META-INF/build-info.properties` at build time (containing the real `project.version` and a build timestamp), which Spring Boot auto-detects and exposes as the `BuildProperties` bean — no new dependency needed.

- [ ] **Step 3: Regenerate backend interfaces and verify they compile**

  Run: `cd backend && ./mvnw -q generate-sources compile`

  Expected: build succeeds; `backend/target/generated-sources/openapi/src/main/java/com/trippyplanner/api/VersionApi.java` and `.../model/VersionInfo.java` now exist.

- [ ] **Step 4: Write the failing controller test**

  Create `backend/src/test/java/com/trippyplanner/version/VersionControllerTest.java`:

  ```java
  package com.trippyplanner.version;

  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.info.BuildProperties;
  import org.springframework.boot.test.context.TestConfiguration;
  import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
  import org.springframework.context.annotation.Bean;
  import org.springframework.context.annotation.Import;
  import org.springframework.test.web.servlet.MockMvc;

  import java.time.Instant;

  import static org.mockito.Mockito.mock;
  import static org.mockito.Mockito.when;
  import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
  import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

  @WebMvcTest(VersionController.class)
  @Import(VersionControllerTest.MocksConfig.class)
  class VersionControllerTest {

      @Autowired MockMvc mvc;

      @Test
      void returnsVersionAndBuildTime() throws Exception {
          when(MocksConfig.buildProperties.getVersion()).thenReturn("2.2.0");
          when(MocksConfig.buildProperties.getTime()).thenReturn(Instant.parse("2026-08-15T12:00:00Z"));

          mvc.perform(get("/version"))
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.version").value("2.2.0"))
              .andExpect(jsonPath("$.buildTime").value("2026-08-15T12:00:00Z"));
      }

      @TestConfiguration
      static class MocksConfig {
          static BuildProperties buildProperties;

          @Bean
          BuildProperties buildProperties() {
              buildProperties = mock(BuildProperties.class);
              return buildProperties;
          }
      }
  }
  ```

- [ ] **Step 5: Run the test to verify it fails**

  Run: `cd backend && ./mvnw -q test -Dtest=VersionControllerTest`
  Expected: FAIL — compilation error, `VersionController` does not exist.

- [ ] **Step 6: Implement `VersionController`**

  Create `backend/src/main/java/com/trippyplanner/version/VersionController.java`:

  ```java
  package com.trippyplanner.version;

  import com.trippyplanner.api.VersionApi;
  import com.trippyplanner.model.VersionInfo;
  import org.springframework.boot.info.BuildProperties;
  import org.springframework.http.ResponseEntity;
  import org.springframework.web.bind.annotation.RestController;

  import java.time.OffsetDateTime;
  import java.time.ZoneOffset;

  @RestController
  public class VersionController implements VersionApi {

      private final BuildProperties buildProperties;

      public VersionController(BuildProperties buildProperties) {
          this.buildProperties = buildProperties;
      }

      @Override
      public ResponseEntity<VersionInfo> getVersion() {
          VersionInfo info = new VersionInfo();
          info.setVersion(buildProperties.getVersion());
          info.setBuildTime(OffsetDateTime.ofInstant(buildProperties.getTime(), ZoneOffset.UTC));
          return ResponseEntity.ok(info);
      }
  }
  ```

- [ ] **Step 7: Run the test to verify it passes**

  Run: `cd backend && ./mvnw -q test -Dtest=VersionControllerTest`
  Expected: PASS

- [ ] **Step 8: Write the failing SecurityFilter test**

  In `backend/src/test/java/com/trippyplanner/common/SecurityFilterTest.java`, add (after `allowsPublicShareWithoutAuth`):

  ```java
      @Test
      void allowsVersionWithoutAuth() throws Exception {
          var req = new MockHttpServletRequest("GET", "/api/version");
          var res = new MockHttpServletResponse();
          var chain = new MockFilterChain();

          filter.doFilter(req, res, chain);

          assertThat(chain.getRequest()).isNotNull();
      }
  ```

- [ ] **Step 9: Run the test to verify it fails**

  Run: `cd backend && ./mvnw -q test -Dtest=SecurityFilterTest#allowsVersionWithoutAuth`
  Expected: FAIL — `res.getStatus()` is 401, `chain.getRequest()` is null (falls through to the Bearer-token check).

- [ ] **Step 10: Add `/version` to `SecurityFilter.PUBLIC_PATHS`**

  In `backend/src/main/java/com/trippyplanner/common/SecurityFilter.java`, change:

  ```java
      private static final Set<String> PUBLIC_PATHS = Set.of(
          "/auth/magic-link",
          "/api/share/",
          // Safe outside e2e profile: MagicLinkTokenTestController is @Profile("e2e"), so this path is unmapped and returns 404 unless e2e is active
          "/test/magic-link-token"
      );
  ```

  to:

  ```java
      private static final Set<String> PUBLIC_PATHS = Set.of(
          "/auth/magic-link",
          "/api/share/",
          // Safe outside e2e profile: MagicLinkTokenTestController is @Profile("e2e"), so this path is unmapped and returns 404 unless e2e is active
          "/test/magic-link-token",
          // Shown in the Tech Details panel to signed-out visitors too
          "/version"
      );
  ```

- [ ] **Step 11: Run the test to verify it passes**

  Run: `cd backend && ./mvnw -q test -Dtest=SecurityFilterTest`
  Expected: PASS (all cases, including the new one)

- [ ] **Step 12: Run the full backend test suite**

  Run: `cd backend && ./mvnw test`
  Expected: PASS

- [ ] **Step 13: Commit**

  ```bash
  git add openapi.yaml backend/pom.xml \
    backend/src/main/java/com/trippyplanner/version/VersionController.java \
    backend/src/test/java/com/trippyplanner/version/VersionControllerTest.java \
    backend/src/main/java/com/trippyplanner/common/SecurityFilter.java \
    backend/src/test/java/com/trippyplanner/common/SecurityFilterTest.java
  git commit -m "feat(backend): add public GET /version endpoint"
  ```

---

## Task 2: Frontend — generate the API client and export `versionApi`

**Files:**
- Modify (generated, gitignored): `frontend/src/api/*`
- Modify: `frontend/src/apiClient.ts`
- Modify: `frontend/src/apiClient.test.ts`

**Interfaces:**
- Consumes: `openapi.yaml`'s `/version` path from Task 1 (must be committed/present on disk — this task does not depend on the backend being *built*, only on the spec file).
- Produces (consumed by Task 3): `versionApi.getVersion(): Promise<{ data: { version: string; buildTime: string } }>`, exported from `frontend/src/apiClient.ts`.

- [ ] **Step 1: Regenerate the frontend API client**

  Run: `cd frontend && npm run generate:api`

  Expected: `frontend/src/api/api.ts` now contains a `VersionApi` class with a `getVersion(options?)` method, and a `VersionInfo` interface with `version: string` and `buildTime: string`.

- [ ] **Step 2: Write the failing apiClient test**

  In `frontend/src/apiClient.test.ts`, change:

  ```ts
    it('exports authApi, routesApi, and shareApi', async () => {
      const { authApi, routesApi, shareApi } = await import('./apiClient')
      expect(authApi).toBeDefined()
      expect(routesApi).toBeDefined()
      expect(shareApi).toBeDefined()
    })
  ```

  to:

  ```ts
    it('exports authApi, routesApi, shareApi, and versionApi', async () => {
      const { authApi, routesApi, shareApi, versionApi } = await import('./apiClient')
      expect(authApi).toBeDefined()
      expect(routesApi).toBeDefined()
      expect(shareApi).toBeDefined()
      expect(versionApi).toBeDefined()
    })
  ```

- [ ] **Step 3: Run the test to verify it fails**

  Run: `cd frontend && npx vitest run apiClient.test.ts`
  Expected: FAIL — `versionApi` is `undefined`.

- [ ] **Step 4: Export `versionApi` from `apiClient.ts`**

  In `frontend/src/apiClient.ts`, change:

  ```ts
  import { AuthApi, RoutesApi, ShareApi } from './api'
  ```

  to:

  ```ts
  import { AuthApi, RoutesApi, ShareApi, VersionApi } from './api'
  ```

  and add, after `export const shareApi = ...`:

  ```ts
  export const versionApi = new VersionApi(undefined, undefined, axiosInstance)
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `cd frontend && npx vitest run apiClient.test.ts`
  Expected: PASS

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/apiClient.ts frontend/src/apiClient.test.ts
  git commit -m "feat(frontend): add versionApi client"
  ```

  Note: `frontend/src/api/` is gitignored and not part of this commit — it regenerates from `openapi.yaml` at build time via `make generate` / `npm run generate:api`.

---

## Task 3: Frontend — display backend version in the Tech Details panel

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `versionApi.getVersion()` from Task 2.

- [ ] **Step 1: Write the failing test for the success path**

  In `frontend/src/App.test.tsx`, change the `./apiClient` mock:

  ```ts
  vi.mock('./apiClient', () => ({
    authApi: { getMe: vi.fn() },
    routesApi: {
      createRoute: vi.fn(),
      updateRoute: vi.fn(),
      listRoutes: vi.fn(),
      getRoute: vi.fn(),
    },
    shareApi: { getSharedRoute: vi.fn() },
  }));
  ```

  to:

  ```ts
  vi.mock('./apiClient', () => ({
    authApi: { getMe: vi.fn() },
    routesApi: {
      createRoute: vi.fn(),
      updateRoute: vi.fn(),
      listRoutes: vi.fn(),
      getRoute: vi.fn(),
    },
    shareApi: { getSharedRoute: vi.fn() },
    versionApi: { getVersion: vi.fn(() => Promise.resolve({ data: undefined })) },
  }));
  ```

  (Default resolves to `undefined` data so every existing test — none of which open Tech Details — is unaffected; individual tests below override it.)

  Then add a new `describe` block at the end of the file:

  ```ts
  describe('backend version display', () => {
    beforeEach(() => {
      window.history.replaceState({}, '', '/')
    })

    it('shows the backend version and build time under the frontend version', async () => {
      const { versionApi } = await import('./apiClient')
      vi.mocked(versionApi.getVersion).mockResolvedValue({
        data: { version: '2.2.0', buildTime: '2026-08-15T12:00:00Z' },
      })

      render(<App />)
      fireEvent.click(screen.getByText('Tech Details'))

      await waitFor(() => {
        expect(screen.getByText('v2.2.0')).toBeInTheDocument()
      })
    })

    it('shows nothing for the backend version when the fetch fails', async () => {
      const { versionApi } = await import('./apiClient')
      vi.mocked(versionApi.getVersion).mockRejectedValue(new Error('network error'))

      render(<App />)
      fireEvent.click(screen.getByText('Tech Details'))

      await waitFor(() => {
        expect(versionApi.getVersion).toHaveBeenCalled()
      })
      // Only the frontend's own version line should render — the backend
      // one is conditional on a successful fetch, with no fallback text.
      expect(screen.queryAllByText(/^v\d+\.\d+\.\d+/)).toHaveLength(1)
    })
  })
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `cd frontend && npx vitest run App.test.tsx -t "backend version display"`
  Expected: FAIL — `versionApi` mock exists but nothing in `App.tsx` calls it or renders `v2.2.0`.

- [ ] **Step 3: Wire up the fetch and render in `App.tsx`**

  Add to the imports (near the existing `import { shareApi } from './apiClient';` at line 19):

  ```ts
  import { versionApi } from './apiClient';
  ```

  Add new state (near `const [user, setUser] = useState<...>` around line 65):

  ```ts
  const [backendVersion, setBackendVersion] = useState<{ version: string; buildTime: string } | null>(null);
  ```

  In the "runs once on mount" effect (around line 250, right after the `isAuthenticated()` block that calls `authApi.getMe()`), add:

  ```ts
      versionApi.getVersion()
        .then(res => setBackendVersion(res.data))
        .catch(() => setBackendVersion(null));

  ```

  In the Tech Details panel, change:

  ```tsx
              <div className="divider my-0" />
              <div className="text-sm font-semibold">v{__APP_VERSION__}</div>
              <div className="text-xs text-base-content/50">{buildDate}</div>

            </div>
  ```

  to:

  ```tsx
              <div className="divider my-0" />
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

            </div>
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `cd frontend && npx vitest run App.test.tsx -t "backend version display"`
  Expected: PASS

- [ ] **Step 5: Run the full frontend test suite**

  Run: `cd frontend && npx vitest run`
  Expected: PASS

- [ ] **Step 6: Type-check and build**

  Run: `cd frontend && npm run build`
  Expected: succeeds with no type errors.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/App.tsx frontend/src/App.test.tsx
  git commit -m "feat(frontend): show backend version under frontend version in Tech Details"
  ```

---

## Task 4: CI/Deploy — pin prod to explicit release versions

**Files:**
- Modify: `k8s/overlays/prod/kustomization.yaml`
- Modify: `.github/actions/release-image/action.yml`

**Interfaces:** none (infra-only; not exercised by any test suite in this repo — see Testing section).

- [ ] **Step 1: Correct the current prod pin to match the last actual releases**

  `git tag -l` shows the last releases are `frontend-v3.0.0` and `backend-v2.1.0`. In `k8s/overlays/prod/kustomization.yaml`, change:

  ```yaml
  images:
  - name: ghcr.io/homelab1025/trippy-planner-frontend
    newName: ghcr.io/homelab1025/trippy-planner-frontend
    newTag: latest
  - name: ghcr.io/homelab1025/trippy-planner-backend
    newName: ghcr.io/homelab1025/trippy-planner-backend
    newTag: latest
  ```

  to:

  ```yaml
  images:
  - name: ghcr.io/homelab1025/trippy-planner-frontend
    newName: ghcr.io/homelab1025/trippy-planner-frontend
    newTag: "3.0.0"
  - name: ghcr.io/homelab1025/trippy-planner-backend
    newName: ghcr.io/homelab1025/trippy-planner-backend
    newTag: "2.1.0"
  ```

- [ ] **Step 2: Make each release workflow keep its own pin up to date**

  In `.github/actions/release-image/action.yml`, add a new step immediately before the existing `Commit release version and tag` step:

  ```yaml
      - name: Pin prod kustomization to release version
        shell: bash
        run: |
          IMAGE="${{ inputs.registry }}/${{ inputs.image_name }}-${{ inputs.image_suffix }}"
          awk -v img="$IMAGE" -v ver="${{ inputs.release_version }}" '
            $0 ~ ("name: " img "$") { inblock=1 }
            inblock && /newTag:/ { sub(/newTag:.*/, "newTag: \"" ver "\""); inblock=0 }
            { print }
          ' k8s/overlays/prod/kustomization.yaml > k8s/overlays/prod/kustomization.yaml.tmp
          mv k8s/overlays/prod/kustomization.yaml.tmp k8s/overlays/prod/kustomization.yaml
  ```

  Then change the `Commit release version and tag` step's `git add` line from:

  ```yaml
        run: |
          git add ${{ inputs.version_file_paths }}
          git commit -m "chore(${{ inputs.component }}): release v${{ inputs.release_version }}"
  ```

  to:

  ```yaml
        run: |
          git add ${{ inputs.version_file_paths }} k8s/overlays/prod/kustomization.yaml
          git commit -m "chore(${{ inputs.component }}): release v${{ inputs.release_version }}"
  ```

  This runs identically for both `release-frontend.yml` and `release-backend.yml` since both call this same composite action — each run only ever matches and rewrites its own component's block (the `awk` pattern anchors on the full image name, and `trippy-planner-frontend` / `trippy-planner-backend` never match each other's line).

- [ ] **Step 3: Verify the awk rewrite locally against a copy of the file**

  Run:
  ```bash
  cp k8s/overlays/prod/kustomization.yaml /tmp/kustomization-test.yaml
  IMAGE="ghcr.io/homelab1025/trippy-planner-frontend"
  awk -v img="$IMAGE" -v ver="3.1.0" '
    $0 ~ ("name: " img "$") { inblock=1 }
    inblock && /newTag:/ { sub(/newTag:.*/, "newTag: \"" ver "\""); inblock=0 }
    { print }
  ' /tmp/kustomization-test.yaml
  ```
  Expected output: the frontend block's `newTag` is now `"3.1.0"`, the backend block's `newTag` is unchanged (`"2.1.0"`).

- [ ] **Step 4: Commit**

  ```bash
  git add k8s/overlays/prod/kustomization.yaml .github/actions/release-image/action.yml
  git commit -m "fix(deploy): pin prod to explicit release versions instead of :latest"
  ```

---

## Testing

- Task 1: `cd backend && ./mvnw test` (unit) — covers `VersionControllerTest` and the new `SecurityFilterTest` case.
- Task 2: `cd frontend && npx vitest run apiClient.test.ts`.
- Task 3: `cd frontend && npx vitest run App.test.tsx` and `npm run build` (type-check).
- Task 4: no automated test exists for GitHub Actions composite actions in this repo. Verified manually per Step 3 above (the `awk` rewrite), and ultimately proven correct only by an actual `workflow_dispatch` run of `release-frontend.yml` or `release-backend.yml` on a real branch (self-hosted runner required — cannot be exercised from a local sandbox), same caveat noted in `docs/superpowers/specs/2026-08-04-independent-component-versioning-design.md`.
- Full-stack smoke test after all four tasks: `make dev`, open the app, click "Tech Details", confirm both a frontend and a backend version line render with plausible-looking `-SNAPSHOT` versions (local dev backend won't have a real release version baked in — that's expected; `mvn generate-sources`/`compile` still populates `build-info.properties` from whatever `pom.xml` currently says).
