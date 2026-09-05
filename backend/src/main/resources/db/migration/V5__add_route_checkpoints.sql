-- checkpoints_json stores an opaque JSON array of user-pinned arrival-time
-- checkpoints for the route (see docs/superpowers/specs/2026-09-05-checkpoint-arrival-times-design.md).
-- NULL means no stored checkpoints; the client falls back to a default.
ALTER TABLE routes ADD COLUMN checkpoints_json TEXT;
