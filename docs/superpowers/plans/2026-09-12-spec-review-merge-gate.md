# Spec Review Merge Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block PRs from merging into `master` when they add or modify a spec file under `docs/superpowers/specs/` unless a human has ticked a "Spec reviewed/updated" checkbox in the PR description.

**Architecture:** A new GitHub Actions workflow (`spec-review-gate` job) runs on every PR, diffs the PR against its base to see if any spec file was added/modified, and if so checks the PR body for the ticked checkbox — failing the check if it's absent. A new PR template adds that checkbox by default. CLAUDE.md's old `markFileAsViewed` self-attestation convention is removed since it's superseded by this enforced human gate. Once the workflow has run once on `master`, its check context is registered as a required status check via the GitHub API.

**Tech Stack:** GitHub Actions (YAML), bash, GitHub CLI (`gh`), GitHub REST API.

**Spec:** `docs/superpowers/specs/2026-09-12-spec-review-merge-gate-design.md`

## Global Constraints

- Workflow triggers: `pull_request` with `types: [opened, synchronize, reopened, edited]`, `branches: ["master"]`.
- Job/check context name: exactly `spec-review-gate` (this is what gets registered as the required status check).
- `runs-on: self-hosted` (matches `build.yml`/`coverage.yml` convention in this repo).
- Checkbox text in the PR template must be exactly `- [ ] Spec reviewed/updated (required if this PR adds or modifies a file under \`docs/superpowers/specs/\`)` so the workflow's regex matches it once ticked.
- Repo is `homelab1025/trippy-planner` (used in `gh api repos/:owner/:repo/...` commands below — `:owner`/`:repo` shorthand resolves automatically from the `gh` CLI's current repo context).

---

### Task 1: PR template

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**
- Produces: the exact checkbox markdown line `- [ ] Spec reviewed/updated (required if this PR adds or modifies a file under \`docs/superpowers/specs/\`)`, which Task 2's workflow regex must match once changed to `[x]`.

- [ ] **Step 1: Create the PR template**

```markdown
## Spec review
- [ ] Spec reviewed/updated (required if this PR adds or modifies a file under `docs/superpowers/specs/`)
```

- [ ] **Step 2: Verify the file content**

Run: `cat .github/PULL_REQUEST_TEMPLATE.md`
Expected: exact content above, no extra whitespace/trailing characters.

- [ ] **Step 3: Commit**

```bash
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -m "chore: add PR template with spec-review checkbox"
```

---

### Task 2: Spec review workflow

**Files:**
- Create: `.github/workflows/spec-review.yml`

**Interfaces:**
- Consumes: the checkbox line produced by Task 1 (regex must match `- [x] Spec reviewed/updated`, case-insensitive on the `x`).
- Produces: a CI check named `spec-review-gate`, consumed by Task 5's branch-protection registration.

- [ ] **Step 1: Create the workflow file**

```yaml
name: Spec Review

on:
  pull_request:
    types: [opened, synchronize, reopened, edited]
    branches: ["master"]

jobs:
  spec-review-gate:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Check spec review checkbox
        env:
          PR_BODY: ${{ github.event.pull_request.body }}
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          CHANGED=$(git diff --name-status "$BASE_SHA" "$HEAD_SHA" -- docs/superpowers/specs/ | grep -E '^[AM]' | cut -f2)
          if [ -z "$CHANGED" ]; then
            echo "No spec files added/modified in this PR — nothing to gate."
            exit 0
          fi
          echo "Spec file(s) changed:"
          echo "$CHANGED"
          if echo "$PR_BODY" | grep -qiE '^\s*-\s*\[x\]\s*Spec reviewed/updated'; then
            echo "Spec review checkbox is ticked."
            exit 0
          fi
          echo "::error::This PR adds/modifies a spec file but the 'Spec reviewed/updated' checkbox in the PR description is not ticked."
          exit 1
```

- [ ] **Step 2: Validate YAML syntax locally**

Run: `npx --yes js-yaml .github/workflows/spec-review.yml > /dev/null && echo "valid YAML"`
Expected: `valid YAML` printed, no parse errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/spec-review.yml
git commit -m "feat: add spec-review-gate CI check"
```

---

### Task 3: CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md` (the `## Pull Requests` section, currently at the end of the file)

**Interfaces:**
- Consumes: nothing from prior tasks (independent doc edit, but described after Tasks 1–2 since it references the new checkbox by name).

- [ ] **Step 1: Read the current section to confirm exact text to remove**

Run: `grep -n "## Pull Requests" -A 20 CLAUDE.md`
Expected: shows the `markFileAsViewed` paragraph and code block that Step 2 removes.

- [ ] **Step 2: Replace the section**

Replace the entire current `## Pull Requests` section body with:

```markdown
## Pull Requests

When commit is done at the end, make sure you commit the spec if there is one.

Any PR that adds or modifies a file under `docs/superpowers/specs/` must have the "Spec reviewed/updated" checkbox in the PR template ticked before it can merge — this is enforced by the `spec-review-gate` CI check (required status check on `master`).
```

This removes the old `markFileAsViewed` GraphQL-mutation paragraph and code block entirely (per the design spec, Section 4 — the agent no longer self-attests review since a human-ticked checkbox is now the actual enforced gate).

- [ ] **Step 3: Verify the old convention is gone and the new note is present**

Run: `grep -n "markFileAsViewed" CLAUDE.md; grep -n "spec-review-gate" CLAUDE.md`
Expected: first `grep` prints nothing (no matches); second `grep` prints the new line.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: replace markFileAsViewed convention with enforced spec-review-gate check"
```

---

### Task 4: End-to-end validation via this feature's own PR

**Files:** none (validation only — no code changes)

**Interfaces:**
- Consumes: the workflow from Task 2, the PR template from Task 1, and relies on this plan's own branch already containing a new spec file (`docs/superpowers/specs/2026-09-12-spec-review-merge-gate-design.md`, added during brainstorming) — so opening this feature's PR naturally exercises the gate against a real spec-file change without needing a separate throwaway PR.

- [ ] **Step 1: Push the branch and open the PR**

```bash
git push -u origin HEAD
gh pr create --title "Add spec-review merge gate" --body "$(cat <<'EOF'
## Spec review
- [ ] Spec reviewed/updated (required if this PR adds or modifies a file under `docs/superpowers/specs/`)
EOF
)"
```

- [ ] **Step 2: Confirm the check appears and fails while unticked**

Run: `gh pr checks --watch`
Expected: a check named `spec-review-gate` appears and fails, with the log line `::error::This PR adds/modifies a spec file but the 'Spec reviewed/updated' checkbox in the PR description is not ticked.` (view via `gh run view --log-failed` on the run it reports).

- [ ] **Step 3: Tick the checkbox and confirm the check re-runs and passes**

```bash
gh pr edit --body "$(cat <<'EOF'
## Spec review
- [x] Spec reviewed/updated (required if this PR adds or modifies a file under `docs/superpowers/specs/`)
EOF
)"
gh pr checks --watch
```

Expected: `spec-review-gate` re-runs against the same head commit (triggered by the `edited` event) and now passes.

---

### Task 5: Register the required status check

**Files:** none (GitHub API/settings change, no repo files)

**Interfaces:**
- Consumes: the `spec-review-gate` check context, which must have at least one completed run on `master` before this step (GitHub API requirement for registering a required status check). This means Task 4's PR must be merged first.

- [ ] **Step 1: Confirm the PR from Task 4 is merged to master and the check has run there**

Run: `gh run list --branch master --workflow spec-review.yml --limit 1`
Expected: at least one run listed with status `completed`/`success`.

- [ ] **Step 2: Read current required_status_checks (baseline, expected empty/null)**

Run: `gh api repos/homelab1025/trippy-planner/branches/master/protection/required_status_checks --jq '.contexts' 2>&1`
Expected: either a 404 (not yet configured) or an empty list — confirms nothing is clobbered by the next step.

- [ ] **Step 3: Register `spec-review-gate` as a required status check**

```bash
gh api -X PATCH repos/homelab1025/trippy-planner/branches/master/protection/required_status_checks \
  -f strict=false \
  -f 'contexts[]=spec-review-gate'
```

- [ ] **Step 4: Verify**

Run: `gh api repos/homelab1025/trippy-planner/branches/master/protection/required_status_checks --jq '.contexts'`
Expected: `["spec-review-gate"]`

Run: `gh api repos/homelab1025/trippy-planner/branches/master/protection --jq '.required_pull_request_reviews, .enforce_admins'`
Expected: unchanged from before this task (still shows `required_approving_review_count: 1`, `enforce_admins.enabled: true`) — confirms the PATCH was additive and didn't clobber existing protection settings.
