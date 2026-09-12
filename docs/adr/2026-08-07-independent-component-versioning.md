# ADR: Independent frontend/backend versioning and release workflows

**Date:** 2026-08-07
**Status:** Accepted
**Related:** [design spec](../superpowers/specs/2026-08-04-independent-component-versioning-design.md)

## Context

A single coupled `release.yml` versioned and released the frontend and
backend together. This had drifted into several bugs: the release job ran
`npm version` from the repo root instead of `frontend/`, `build.yml` tagged
both Docker images from the frontend's version only, and the backend's
Docker build derived its image tag from `pom.xml`'s version rather than a
fixed build artifact name — so a version bump in one component could tag or
break the other's image.

## Decision

- Split the single release workflow into `release-frontend.yml` and
  `release-backend.yml`, each bumping and releasing only its own component,
  built on a shared composite action (`.github/actions/release-image/action.yml`)
  rather than duplicating the release steps in each workflow.
- Decouple the backend's Docker build from `pom.xml`'s version: the JAR gets
  a fixed `finalName` so `backend/Dockerfile` no longer needs to know the
  current Maven version to find the artifact to copy.
- Fix `build.yml` to tag each image from its own component's version instead
  of both from the frontend's.

## Consequences

- Frontend and backend now ship on independent version numbers and release
  cadences; a backend-only fix no longer forces a frontend version bump (or
  vice versa).
- The shared composite action means a release-process fix (e.g. the atomic
  push/tag fix that followed this change) is written once and applies to
  both workflows automatically.
- `k8s` overlays and any tooling that assumed one version for both images
  needed to be, or still need to be, updated to track two independent
  version numbers.

## Changes to prior decisions

- Splits the single `release.yml` workflow established by the [2026-05-26
  semver ADR](2026-05-26-semver-release-workflow.md) into two independent
  workflows, one per component. That ADR predates the backend's existence
  (added six weeks later by [ADR: Backend service, magic-link auth, and
  route persistence
  architecture](2026-07-18-backend-auth-and-persistence-architecture.md)),
  so this reads less as a deliberate reversal than as the two-component
  setup catching up to a decision made in a one-component era.
