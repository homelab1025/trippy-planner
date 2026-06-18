-- gpx_content stores the raw GPX XML. Immutable after creation.
-- share_token is NULL when private; a 20-char token when public.
CREATE TABLE routes (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT         NOT NULL,
  gpx_content   TEXT         NOT NULL,
  avg_speed_kmh NUMERIC(5,2) NOT NULL,
  start_time    TIMESTAMPTZ  NOT NULL,
  is_public     BOOLEAN      NOT NULL DEFAULT false,
  share_token   TEXT         UNIQUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
