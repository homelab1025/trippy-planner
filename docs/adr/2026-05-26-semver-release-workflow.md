# ADR: Semver-based two-workflow release process

**Date:** 2026-05-26
**Status:** Accepted
**Related:** none

## Context

The build pipeline tagged every push to `master` with a timestamp+SHA
image tag and pushed it as `:latest`, so there was no stable,
human-meaningful version identifier for a deployed image, and every build
push — not just an intentional release — moved `:latest`.

## Decision

- Track version as semver in `package.json`, starting at `1.0.0-SNAPSHOT`.
- Split CI into two workflows: `build.yml` (every push to `master`, tags
  the image with the current `package.json` version, no longer touches
  `:latest`) and a new `release.yml` (manual `workflow_dispatch` with a
  `bump_type` input: major/minor/patch, default minor).
- `release.yml` strips the `-SNAPSHOT` suffix, runs the full unit + E2E
  test suite, pushes the release image tagged with the release version
  and `:latest`, commits the release version bump plus a `git tag`, then
  bumps `package.json` to the next `-SNAPSHOT` version and pushes that
  too.
- `:latest` is now reserved exclusively for intentional releases, not
  every build.

## Alternatives considered

- **Keep timestamp+SHA tagging** — rejected; gives no human-meaningful
  version and provides no distinction between "just built" and
  "released."
- **Tag-triggered releases** (push a git tag to trigger release) —
  rejected in favor of a manual `workflow_dispatch` with an explicit
  bump-type choice, giving control over major/minor/patch at release time
  rather than inferring it from a pushed tag.

## Consequences

- Every release now requires a manual trigger with an explicit
  version-bump choice; nothing ships to `:latest` as a side effect of
  merging to `master`.
- The release job commits directly back to `master` (version bump + tag)
  as `github-actions[bot]`, so `master`'s history includes bot-authored
  release commits going forward.
- A later PR (#52, "fix(ci): push release commits and tag atomically")
  had to fix a race in this same release job — evidence the commit-then-tag
  push introduced here wasn't fully atomic at first.
