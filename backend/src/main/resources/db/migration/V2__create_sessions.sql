-- Session token IS the magic link (see spec security note).
-- Token is a 20-character random URL-safe string.
CREATE TABLE sessions (
  token      TEXT        PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
