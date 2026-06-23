-- M20 public presence heartbeat state. This table stores daily pseudonymous IDs only.
CREATE TABLE IF NOT EXISTS visitor_presence (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  day TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT '',
  UNIQUE(day, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_presence_last_seen
  ON visitor_presence (last_seen_at);
