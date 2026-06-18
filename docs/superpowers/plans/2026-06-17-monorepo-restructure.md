# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing Vite/React frontend into `frontend/`, establish `openapi.yaml` as the contract source of truth, and add root-level orchestration (Makefile, docker-compose, updated K8s manifests) — no new features.

**Architecture:** Pure reorganisation. The repo root becomes a monorepo root. All existing functionality stays intact — tests still pass, builds still work. Subsequent plans (backend API, frontend integration) depend on this restructure being complete first.

**Tech Stack:** git mv, Docker Compose v3, GNU Make, Traefik ingress

---

### Task 1: Move frontend files into `frontend/`

**Files:**
- Create: `frontend/` directory
- Move: all Vite/React files listed below via `git mv`

- [ ] **Step 1: Create directory and move config files**

```bash
mkdir frontend
git mv package.json frontend/package.json
git mv package-lock.json frontend/package-lock.json
git mv vite.config.ts frontend/vite.config.ts
git mv tsconfig.json frontend/tsconfig.json
git mv tsconfig.app.json frontend/tsconfig.app.json
git mv tsconfig.node.json frontend/tsconfig.node.json
git mv tailwind.config.js frontend/tailwind.config.js
git mv postcss.config.js frontend/postcss.config.js
git mv eslint.config.js frontend/eslint.config.js
git mv stryker.config.json frontend/stryker.config.json
git mv index.html frontend/index.html
```

- [ ] **Step 2: Move source trees**

```bash
git mv src frontend/src
git mv public frontend/public
git mv nginx frontend/nginx
git mv tests frontend/tests
git mv samples frontend/samples
git mv playwright-screenshots frontend/playwright-screenshots
git mv Dockerfile frontend/Dockerfile
git mv playwright.config.ts frontend/playwright.config.ts
```

- [ ] **Step 3: Install node_modules in new location**

```bash
cd frontend && npm install
```

- [ ] **Step 4: Verify unit tests pass**

```bash
cd frontend && npx vitest run
```

Expected: all tests pass, no path errors.

- [ ] **Step 5: Verify production build works**

```bash
cd frontend && npm run build
```

Expected: `frontend/dist/` is created successfully.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "refactor: move frontend app into frontend/ subdirectory"
```

---

### Task 2: Update Playwright config for new location

**Files:**
- Modify: `frontend/playwright.config.ts`

The `webServer.command` runs `npm run dev` from the same directory as the config — already correct after the move. The `testDir` is `./tests` — also correct. Only the screenshot output directory needs verifying.

- [ ] **Step 1: Update outputDir for screenshots**

Edit `frontend/playwright.config.ts` to add an explicit output directory:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './playwright-screenshots',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Run E2E tests**

```bash
cd frontend && npx playwright test
```

Expected: all E2E tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/playwright.config.ts
git commit -m "fix: set explicit playwright outputDir after frontend/ move"
```

---

### Task 3: Add `frontend/.dockerignore` and verify Docker build

**Files:**
- Create: `frontend/.dockerignore`

The `frontend/Dockerfile` already uses paths relative to its build context (`frontend/`) — no changes needed to the Dockerfile itself.

- [ ] **Step 1: Create `frontend/.dockerignore`**

```
node_modules
dist
coverage
playwright-report
test-results
playwright-screenshots
*.log
.DS_Store
```

- [ ] **Step 2: Test Docker build**

```bash
docker build -t trippy-frontend:test frontend/
```

Expected: image builds, nginx serves the Vite output.

- [ ] **Step 3: Commit**

```bash
git add frontend/.dockerignore
git commit -m "build: add frontend .dockerignore for Docker build context"
```

---

### Task 4: Add vite proxy for `/api` in dev

**Files:**
- Modify: `frontend/vite.config.ts`

In local dev (docker-compose), the frontend dev server proxies `/api/*` to the backend at `http://backend:8080`. This eliminates CORS issues without touching nginx or Spring Boot config.

- [ ] **Step 1: Add proxy to vite.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    proxy: {
      '/api': 'http://backend:8080',
    },
  },
  test: {
    environment: 'node',
    exclude: ['node_modules', 'dist', 'tests'],
    setupFiles: ['./src/vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "feat: proxy /api to backend in Vite dev server"
```

---

### Task 5: Write `openapi.yaml`

**Files:**
- Create: `openapi.yaml` (repo root)

This is the API contract. Both the Spring Boot backend (Task 2 in the backend plan) and the TypeScript frontend (Task 1 in the frontend integration plan) generate code from this file.

- [ ] **Step 1: Write the full spec**

```yaml
openapi: 3.0.3
info:
  title: Trippy Planner API
  version: 1.0.0

servers:
  - url: /api

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer

  schemas:
    MagicLinkRequest:
      type: object
      required: [email]
      properties:
        email:
          type: string
          format: email

    User:
      type: object
      required: [id, email]
      properties:
        id:
          type: integer
          format: int64
        email:
          type: string

    RouteListItem:
      type: object
      required: [id, name, avgSpeedKmh, startTime, isPublic, createdAt]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        avgSpeedKmh:
          type: number
          format: double
        startTime:
          type: string
          format: date-time
        isPublic:
          type: boolean
        createdAt:
          type: string
          format: date-time

    Route:
      allOf:
        - $ref: '#/components/schemas/RouteListItem'
        - type: object
          required: [gpxContent]
          properties:
            gpxContent:
              type: string

    CreateRouteRequest:
      type: object
      required: [name, gpxContent, avgSpeedKmh, startTime]
      properties:
        name:
          type: string
        gpxContent:
          type: string
        avgSpeedKmh:
          type: number
          format: double
        startTime:
          type: string
          format: date-time

    UpdateRouteRequest:
      type: object
      properties:
        name:
          type: string
        avgSpeedKmh:
          type: number
          format: double
        startTime:
          type: string
          format: date-time

    ShareResponse:
      type: object
      required: [shareToken]
      properties:
        shareToken:
          type: string

paths:
  /auth/magic-link:
    post:
      tags: [auth]
      operationId: requestMagicLink
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MagicLinkRequest'
      responses:
        '204':
          description: Magic link sent (always, even if email unknown)

  /auth/me:
    get:
      tags: [auth]
      operationId: getMe
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Current user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '401':
          description: Invalid or expired token

  /auth/session:
    delete:
      tags: [auth]
      operationId: deleteSession
      security:
        - bearerAuth: []
      responses:
        '204':
          description: Session deleted

  /routes:
    get:
      tags: [routes]
      operationId: listRoutes
      security:
        - bearerAuth: []
      responses:
        '200':
          description: User's routes (no gpxContent)
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/RouteListItem'
    post:
      tags: [routes]
      operationId: createRoute
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateRouteRequest'
      responses:
        '201':
          description: Route created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Route'

  /routes/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    get:
      tags: [routes]
      operationId: getRoute
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Full route including gpxContent
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Route'
        '403':
          description: Route belongs to another user
        '404':
          description: Route not found
    put:
      tags: [routes]
      operationId: updateRoute
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateRouteRequest'
      responses:
        '200':
          description: Updated route
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Route'
    delete:
      tags: [routes]
      operationId: deleteRoute
      security:
        - bearerAuth: []
      responses:
        '204':
          description: Route deleted

  /routes/{id}/share:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    post:
      tags: [routes]
      operationId: shareRoute
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Share token (idempotent — returns existing if already public)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ShareResponse'
    delete:
      tags: [routes]
      operationId: unshareRoute
      security:
        - bearerAuth: []
      responses:
        '204':
          description: Route made private, share link invalidated

  /share/{shareToken}:
    get:
      tags: [share]
      operationId: getSharedRoute
      parameters:
        - name: shareToken
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Public route (no auth required)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Route'
        '404':
          description: Token not found or route no longer public
```

- [ ] **Step 2: Validate the spec**

```bash
npx @redocly/cli lint openapi.yaml
```

Expected: `No errors or warnings`.

- [ ] **Step 3: Commit**

```bash
git add openapi.yaml
git commit -m "feat: add OpenAPI spec as API contract source of truth"
```

---

### Task 6: Add root `Makefile` and `docker-compose.yml`

**Files:**
- Create: `Makefile`
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Write `Makefile`**

```makefile
.PHONY: generate build dev test

generate:
	cd frontend && npm run generate:api
	cd backend && ./mvnw generate-sources -q

build:
	docker build -t trippy-frontend:latest frontend/
	docker build -t trippy-backend:latest backend/

dev:
	docker compose up --build

test:
	cd frontend && npx vitest run
	cd backend && ./mvnw test -q
```

- [ ] **Step 2: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: trippy
      POSTGRES_USER: trippy
      POSTGRES_PASSWORD: trippy
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/trippy
      SPRING_DATASOURCE_USERNAME: trippy
      SPRING_DATASOURCE_PASSWORD: trippy
      RESEND_API_KEY: ${RESEND_API_KEY}
      APP_BASE_URL: ${APP_BASE_URL:-http://localhost:5173}
      SESSION_EXPIRY_MINUTES: ${SESSION_EXPIRY_MINUTES:-43200}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/api/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    build:
      context: ./frontend
      target: build
    command: npm run dev -- --host 0.0.0.0
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  postgres_data:
```

Note: the `postgres` service needs a healthcheck so `backend` waits for the DB before starting. Add one to postgres:

```yaml
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: trippy
      POSTGRES_USER: trippy
      POSTGRES_PASSWORD: trippy
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U trippy -d trippy"]
      interval: 5s
      timeout: 5s
      retries: 10
```

- [ ] **Step 3: Write `.env.example`**

```
RESEND_API_KEY=re_your_key_here
APP_BASE_URL=http://localhost:5173
SESSION_EXPIRY_MINUTES=43200
```

- [ ] **Step 4: Add `.env` to `.gitignore`**

Add these lines to root `.gitignore` (create it if missing):

```
.env
frontend/src/api/
backend/target/
```

- [ ] **Step 5: Commit**

```bash
git add Makefile docker-compose.yml .env.example .gitignore
git commit -m "build: add Makefile and docker-compose for monorepo orchestration"
```

---

### Task 7: Update K8s manifests

**Files:**
- Modify: `k8s/base/kustomization.yaml`
- Rename: `k8s/base/deployment.yaml` → `k8s/base/frontend-deployment.yaml`
- Rename: `k8s/base/service.yaml` → `k8s/base/frontend-service.yaml`
- Modify: `k8s/base/ingress.yaml`
- Create: `k8s/base/backend-deployment.yaml`
- Create: `k8s/base/backend-service.yaml`
- Create: `k8s/base/backend-secret.yaml`

- [ ] **Step 1: Rename existing frontend manifests**

```bash
git mv k8s/base/deployment.yaml k8s/base/frontend-deployment.yaml
git mv k8s/base/service.yaml k8s/base/frontend-service.yaml
```

- [ ] **Step 2: Update `k8s/base/kustomization.yaml`**

```yaml
resources:
  - frontend-deployment.yaml
  - frontend-service.yaml
  - backend-deployment.yaml
  - backend-service.yaml
  - backend-secret.yaml
  - ingress.yaml
```

- [ ] **Step 3: Create `k8s/base/backend-deployment.yaml`**

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
          envFrom:
            - secretRef:
                name: trippy-backend-secret
```

- [ ] **Step 4: Create `k8s/base/backend-service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: trippy-backend
spec:
  selector:
    app: trippy-backend
  ports:
    - port: 8080
      targetPort: 8080
```

- [ ] **Step 5: Create `k8s/base/backend-secret.yaml`**

Fill in actual values before applying to the cluster. This file is a template — do not commit secrets.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: trippy-backend-secret
type: Opaque
stringData:
  SPRING_DATASOURCE_URL: "jdbc:postgresql://<host>:5432/trippy"
  SPRING_DATASOURCE_USERNAME: "trippy"
  SPRING_DATASOURCE_PASSWORD: "<password>"
  RESEND_API_KEY: "<key>"
  APP_BASE_URL: "https://trippy.lab.wicked"
  SESSION_EXPIRY_MINUTES: "43200"
```

- [ ] **Step 6: Update `k8s/base/ingress.yaml` to route `/api` to backend**

The cluster uses Traefik. Add a `/api` path rule before the catch-all `/`. Traefik matches more specific (longer) prefixes first.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: trippy-planner-ingress
  annotations:
    kubernetes.io/ingress.class: traefik
spec:
  rules:
    - host: trippy.lab.wicked
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: trippy-backend
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: trippy-planner
                port:
                  number: 80
    - host: trippy.homelab1025.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: trippy-backend
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: trippy-planner
                port:
                  number: 80
```

- [ ] **Step 7: Commit**

```bash
git add k8s/
git commit -m "infra: update k8s manifests for monorepo and backend service"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Commands section**

Replace the existing Commands section with:

```markdown
## Commands

### Frontend (run from `frontend/`)
\`\`\`bash
cd frontend && npm run dev        # start dev server at http://localhost:5173
cd frontend && npm run build      # type-check + Vite production build
cd frontend && npm run lint       # ESLint
cd frontend && npx vitest run     # run unit tests once (CI mode)
cd frontend && npx playwright test  # run all E2E tests
cd frontend && npm run generate:api # regenerate TypeScript Axios client from openapi.yaml
\`\`\`

### Backend (run from `backend/`)
\`\`\`bash
cd backend && ./mvnw spring-boot:run   # start backend at http://localhost:8080
cd backend && ./mvnw test              # run unit + integration tests
cd backend && ./mvnw generate-sources  # regenerate Spring interfaces from openapi.yaml
cd backend && ./mvnw -Pnative native:compile  # build GraalVM native binary
\`\`\`

### Full stack
\`\`\`bash
make dev        # start everything via docker-compose
make generate   # regenerate both TypeScript client and Spring interfaces
make build      # build both Docker images
make test       # run all tests
\`\`\`
```

- [ ] **Step 2: Update the Architecture section to reflect monorepo**

Add a note that the app now lives in `frontend/` and the backend is in `backend/`. Update any file paths in the Architecture section that reference `src/` to `frontend/src/`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for monorepo structure"
```
