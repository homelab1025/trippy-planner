# Design: GitHub Actions Coverage Pages

**Date:** 2026-06-05
**Status:** Approved

## Goal

Publish Vitest HTML coverage reports to GitHub Pages automatically on every push to `master`, so coverage history is browsable at a stable URL.

## Trigger

`push` to `master` branch.

## Workflow file

`.github/workflows/coverage.yml` — separate from `build.yml` to keep Docker image publishing and coverage publishing independently maintainable.

## Jobs

### `generate` (runs on `self-hosted`)

1. Checkout repository
2. Run coverage inside Docker (same pattern as existing `unit-test` job):
   ```
   docker run --rm \
     --user $(id -u):$(id -g) \
     --env HOME=/tmp \
     -v "${{ github.workspace }}:/app" \
     -w /app \
     node:24-alpine \
     sh -c "npm ci && npx vitest run --coverage"
   ```
3. Upload `coverage/` directory as a Pages artifact via `actions/upload-pages-artifact@v3`

### `deploy` (runs on `ubuntu-latest`)

- Depends on `generate`
- Deploys the uploaded artifact to GitHub Pages via `actions/deploy-pages@v4`
- Must run on `ubuntu-latest` (requirement of `actions/deploy-pages`)

## Permissions

Workflow-level default: `contents: read` (read-only).

The `deploy` job overrides with:
- `pages: write` — publish the Pages artifact
- `id-token: write` — OIDC token required by `actions/deploy-pages`

## One-time prerequisite

In GitHub repo Settings → Pages → Source: set to **"GitHub Actions"** (not a branch). This must be done once before the workflow can deploy.

## Output URL

`https://<username>.github.io/<repo-name>/`

## What is not in scope

- E2E coverage (Playwright has no built-in HTML coverage reporter integrated here)
- Mutation testing report (separate `npm run test:mutation` concern)
- Coverage gating / PR comments (not requested)
