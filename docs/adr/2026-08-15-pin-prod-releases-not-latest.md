# ADR: Pin prod deployments to explicit release versions instead of :latest

**Date:** 2026-08-15
**Status:** Accepted
**Related:** [FDR: Show backend version in Tech Details](../fdr/2026-08-15-show-backend-version.md), [design spec](../superpowers/specs/2026-08-15-version-display-design.md)

## Context

`k8s/overlays/prod/kustomization.yaml` tracked the mutable `:latest` image
tag. `build.yml` re-pushed `:latest` on every push to master, including the
release automation's own post-release SNAPSHOT-bump commit — so prod could
end up running an untagged, unreleased build rather than the version that
was actually cut as a release. This surfaced concretely as the Tech Details
panel showing a stale `-SNAPSHOT` version in prod.

## Decision

- Prod overlays pin an explicit release version tag rather than `:latest`.
- `.github/actions/release-image/action.yml` — the same composite action
  introduced for [independent frontend/backend releases](2026-08-07-independent-component-versioning.md)
  — updates the pinned prod tag automatically on every future release, so
  keeping prod current stays a byproduct of releasing rather than a manual
  step.

## Consequences

- Prod now only ever runs a version that went through the release workflow,
  never an arbitrary latest master build.
- A release that needs to reach prod must go through `release-frontend.yml`
  / `release-backend.yml`; there's no longer an implicit "just push to
  master" path to a prod deploy.

## Changes to prior decisions

- Does not restore the [2026-05-26 semver ADR](2026-05-26-semver-release-workflow.md)'s
  "`:latest` reserved for intentional releases only" decision, which
  `build.yml` had already stopped honoring by the time this ADR was written
  (see [ADR: Backend service, magic-link auth, and route persistence
  architecture](2026-07-18-backend-auth-and-persistence-architecture.md)).
  This ADR mitigates the symptom — prod no longer tracks the mutable tag —
  without fixing `build.yml` itself, which still pushes `:latest` on every
  push as of this writing.
