-- Public analytics abuse guard. Stores only short-lived hashed rate-limit buckets.
CREATE TABLE IF NOT EXISTS public_write_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_write_rate_limits_expires_at
  ON public_write_rate_limits (expires_at);
