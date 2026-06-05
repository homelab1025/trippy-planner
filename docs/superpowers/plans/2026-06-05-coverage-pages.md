# Coverage Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Vitest HTML coverage reports to GitHub Pages on every push to `master` via a new `coverage.yml` GitHub Actions workflow.

**Architecture:** A two-job workflow — `generate` runs on the existing self-hosted runner (Docker, same pattern as `unit-test`) to produce coverage HTML, then uploads it as a Pages artifact; `deploy` runs on `ubuntu-latest` and calls `actions/deploy-pages` to publish. `vite.config.ts` gets explicit `reporter: ['text', 'html']` so HTML output is guaranteed regardless of Vitest version defaults.

**Tech Stack:** Vitest + `@vitest/coverage-v8`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`, GitHub Pages (source: GitHub Actions)

---

## Files

| Action | Path |
|--------|------|
| Modify | `vite.config.ts` |
| Create | `.github/workflows/coverage.yml` |

---

### Task 1: Add explicit HTML coverage reporter to `vite.config.ts`

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add coverage reporter config**

  In `vite.config.ts`, extend the `test` block to add a `coverage` key:

  ```typescript
  test: {
    environment: 'node',
    exclude: ['node_modules', 'dist', 'tests'],
    setupFiles: ['./src/vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
  ```

  Full file after change:

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
    test: {
      environment: 'node',
      exclude: ['node_modules', 'dist', 'tests'],
      setupFiles: ['./src/vitest.setup.ts'],
      coverage: {
        reporter: ['text', 'html'],
      },
    },
  })
  ```

- [ ] **Step 2: Verify HTML output is generated locally**

  Run:
  ```bash
  npm run test:coverage
  ```

  Expected: tests pass, then check `coverage/index.html` exists:
  ```bash
  ls coverage/index.html
  ```
  Expected: file exists (no "No such file" error).

- [ ] **Step 3: Clean up coverage output**

  ```bash
  rm -rf coverage
  ```

---

### Task 2: Create `coverage.yml` workflow

**Files:**
- Create: `.github/workflows/coverage.yml`

- [ ] **Step 1: Create the workflow file**

  Create `.github/workflows/coverage.yml` with this exact content:

  ```yaml
  name: Coverage

  on:
    push:
      branches: ["master"]

  permissions:
    contents: read

  jobs:
    generate:
      runs-on: self-hosted
      steps:
        - name: Checkout
          uses: actions/checkout@v6

        - name: Generate coverage report
          run: |
            docker run --rm \
              --user $(id -u):$(id -g) \
              --env HOME=/tmp \
              -v "${{ github.workspace }}:/app" \
              -w /app \
              node:24-alpine \
              sh -c "npm ci && npx vitest run --coverage"

        - name: Upload Pages artifact
          uses: actions/upload-pages-artifact@v3
          with:
            path: coverage

    deploy:
      runs-on: ubuntu-latest
      needs: generate
      permissions:
        pages: write
        id-token: write
      environment:
        name: github-pages
        url: ${{ steps.deployment.outputs.page_url }}
      steps:
        - name: Deploy to GitHub Pages
          id: deployment
          uses: actions/deploy-pages@v4
  ```

- [ ] **Step 2: Verify the file is valid YAML**

  Run:
  ```bash
  npx js-yaml .github/workflows/coverage.yml
  ```
  Expected: prints the parsed YAML object with no errors. If `js-yaml` is not available, visually verify indentation (2-space, no tabs).

---

### Task 3: Enable GitHub Pages in repo settings (manual, one-time)

- [ ] **Step 1: Open repo settings**

  Go to: `https://github.com/<username>/<repo-name>/settings/pages`

- [ ] **Step 2: Set source to GitHub Actions**

  Under **Source**, select **GitHub Actions** (not "Deploy from a branch").

  Save. No branch needs to exist — GitHub Actions deployment handles it.

---

### Task 4: Commit, push, and verify

- [ ] **Step 1: Commit both changes**

  ```bash
  git add vite.config.ts .github/workflows/coverage.yml docs/superpowers/
  git commit -m "ci: publish vitest coverage report to github pages"
  ```

- [ ] **Step 2: Push to master**

  ```bash
  git push origin master
  ```

- [ ] **Step 3: Verify the workflow runs**

  Go to: `https://github.com/<username>/<repo-name>/actions`

  Expected: a new **Coverage** workflow run appears. Both `generate` and `deploy` jobs should complete with green checkmarks.

- [ ] **Step 4: Verify the Pages URL works**

  Open: `https://<username>.github.io/<repo-name>/`

  Expected: Vitest HTML coverage report loads in the browser, showing per-file coverage breakdown.
