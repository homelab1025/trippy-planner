# Block PR Merges Until Specs Are Reviewed — Design Spec

**Date:** 2026-09-12

## Context

CLAUDE.md currently documents a convention (under "## Pull Requests") where, after creating a PR for a feature, the agent marks the corresponding spec file in `docs/superpowers/specs/` as "viewed" via the GitHub GraphQL `markFileAsViewed` mutation. This is optional and self-attested by the agent — nothing prevents a PR from merging without an actual human review of the spec.

GitHub issue #71 asks for this to become an enforced merge gate: a PR that adds or modifies a spec file must have a human confirm they reviewed it before the PR can merge into `master`. Branch protection on `master` is already enabled (`required_pull_request_reviews`, `enforce_admins`) but has no `required_status_checks` configured yet — this is the first required CI check in the repo.

## Design

### 1. Trigger condition — spec file present in the diff

The gate applies only to PRs whose diff adds or modifies at least one file under `docs/superpowers/specs/**` (git status `A` or `M`, diffed against the PR's base SHA). PRs that don't touch a spec file are unaffected — the job passes immediately with no requirement. This deliberately does *not* key off `frontend/`, `backend/`, or `openapi.yaml` paths (the issue's original suggestion) — scoping to "a spec file is actually part of this PR" is simpler and avoids false positives on PRs that touch those paths without warranting a spec.

### 2. `.github/PULL_REQUEST_TEMPLATE.md` (new)

```markdown
## Spec review
- [ ] Spec reviewed/updated (required if this PR adds or modifies a file under `docs/superpowers/specs/`)
```

PRs opened without the template (e.g. via API) simply won't have the box ticked, so the gate fails closed — pushing authors back toward using the template.

### 3. `.github/workflows/spec-review.yml` (new)

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

Runs on `self-hosted`, matching `build.yml`/`coverage.yml`. `types` includes `edited` (not part of the `pull_request` default set) so that ticking the box after the PR is already open — which only changes the PR body, not the head commit — re-triggers the check against the same head SHA and can flip it to passing without requiring a new commit.

The job name `spec-review-gate` is the status-check context that becomes required in branch protection.

### 4. CLAUDE.md changes

Remove the `markFileAsViewed` GraphQL mutation convention (the paragraph and code block under "## Pull Requests" instructing the agent to mark the spec as viewed after creating a PR) — it let the agent self-attest review, which is no longer meaningful now that a human-ticked checkbox is the actual enforced gate. Keep "make sure you commit the spec if there is one." Add a line noting that any PR adding/modifying a spec file must have the PR-template checkbox ticked before merge, enforced by the `spec-review-gate` CI check.

### 5. Branch protection

After this workflow is merged to `master` and has run at least once (so GitHub has a check run to reference), apply via `gh api`:

```bash
gh api -X PATCH repos/:owner/:repo/branches/master/protection/required_status_checks \
  -f strict=false \
  -f 'contexts[]=spec-review-gate'
```

This is additive to the branch's existing protection settings (`required_pull_request_reviews`, `enforce_admins`, etc.) — those are untouched.

## Testing

No unit tests for a workflow file itself. Validation is manual: open a throwaway PR that adds a dummy file under `docs/superpowers/specs/`, confirm the check fails while the checkbox is unticked, tick it via a PR body edit, confirm the check re-runs on the same head SHA and passes — then close the PR without merging.

## Out of scope

- Any mapping from source-code paths (`frontend/`, `backend/`, `openapi.yaml`) to a specific spec file — the gate only reacts to spec files actually present in the diff, not to inferring which spec *should* have been touched.
- Enforcing that the spec's *content* actually matches the shipped implementation (the "strict" option from the issue) — this is a human-attested checkbox, not a content diff check.
- Fork-PR handling — not a concern for this repo's current single-owner contribution model.
