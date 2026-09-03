CREATE TABLE IF NOT EXISTS runtime_incidents (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL,
  bucket_started_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('runtime_error', 'unhandled_rejection', 'api_failure')),
  surface TEXT NOT NULL CHECK (surface IN ('public', 'admin', 'auth', 'unknown')),
  pathname TEXT NOT NULL,
  error_name TEXT NOT NULL,
  api_method TEXT NOT NULL DEFAULT '',
  http_status INTEGER,
  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_request_id TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_incidents_dedupe_bucket
  ON runtime_incidents (dedupe_key, bucket_started_at);

CREATE INDEX IF NOT EXISTS idx_runtime_incidents_last_seen
  ON runtime_incidents (last_seen_at DESC, id DESC);
