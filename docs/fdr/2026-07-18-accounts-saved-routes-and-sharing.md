# FDR: Accounts, saved routes, and public sharing

**Date:** 2026-07-18
**Status:** Shipped
**Related:** [ADR: Backend service, magic-link auth, and route persistence architecture](../adr/2026-07-18-backend-auth-and-persistence-architecture.md), [design spec](../superpowers/specs/2026-06-17-auth-backend-design.md)

## Problem

The app was entirely client-side and ephemeral (issue #37) — a route was
lost the moment the tab closed, and there was no way to revisit a route
later, access it from another device, or share it with anyone else.

## Decision (highlights)

- Passwordless sign-in: enter an email, get a magic link, click it and
  you're in — no password to set or remember.
- "Save route" persists the current GPX + speed/start-time as a named
  route under the signed-in account.
- "My routes" lists a user's saved routes in the sidebar; clicking one
  loads it as if freshly uploaded.
- A share toggle on an owned route generates a public link
  (`{APP_BASE_URL}/share/{token}`); visiting it shows a read-only "Viewing
  a shared route" view with no save/share controls. Turning sharing off
  immediately invalidates the old link.
- Signing in is available directly from the header at any time, not only
  when triggered by trying to save — sign-in and saving are independent
  actions.

## Outcome vs. spec

Shipped materially as specified, with the backend image built as a plain
JVM fat jar instead of the spec's original GraalVM native-binary plan (see
the companion ADR) — no functional difference to this feature. Everything
the spec marked out of scope (fine-grained sharing permissions, OAuth/social
login, the httpOnly-cookie session upgrade, email deliverability fallback,
public route discovery, route version history) is still out of scope.
