-- M18 Admin + D1 Write Batch Migration.
-- Additive only: no production data, no destructive schema changes, and no cutover.

PRAGMA foreign_keys = ON;

ALTER TABLE contents ADD COLUMN owner TEXT NOT NULL DEFAULT '';
ALTER TABLE contents ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE contents ADD COLUMN deleted_at TEXT NOT NULL DEFAULT '';
ALTER TABLE contents ADD COLUMN created_by TEXT NOT NULL DEFAULT '';
ALTER TABLE contents ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE contents ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE documents ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN deleted_at TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN created_by TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public_home_sections ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE public_home_sections ADD COLUMN deleted_at TEXT NOT NULL DEFAULT '';
ALTER TABLE public_home_sections ADD COLUMN created_by TEXT NOT NULL DEFAULT '';
ALTER TABLE public_home_sections ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE public_home_sections ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE visitor_daily_stats ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE visitor_daily_stats ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE visitor_daily_stats ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contents_slug_active
  ON contents (slug)
  WHERE COALESCE(deleted_at, '') = '';

CREATE INDEX IF NOT EXISTS idx_contents_admin_updated
  ON contents (deleted_at, updated_at, revision);

CREATE INDEX IF NOT EXISTS idx_documents_admin_updated
  ON documents (deleted_at, updated_at, revision);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_home_sections_key_active
  ON public_home_sections (section_key)
  WHERE COALESCE(deleted_at, '') = '';

CREATE INDEX IF NOT EXISTS idx_public_home_sections_admin_updated
  ON public_home_sections (deleted_at, updated_at, revision);

CREATE INDEX IF NOT EXISTS idx_visitor_daily_stats_admin_updated
  ON visitor_daily_stats (updated_at, revision);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity_created
  ON admin_audit_log (entity_type, entity_id, created_at);
