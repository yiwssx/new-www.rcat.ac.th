-- M17-B public-read core batch additions for the isolated Cloudflare Worker.
-- Additive only: no production data, no production D1 identifiers, and no cutover.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS public_home_sections (
  id TEXT PRIMARY KEY,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_public_home_sections_enabled_order
  ON public_home_sections (enabled, sort_order, updated_at);

CREATE INDEX IF NOT EXISTS idx_contents_public_search
  ON contents (status, type, title, summary, category);

CREATE INDEX IF NOT EXISTS idx_visitor_daily_stats_day
  ON visitor_daily_stats (day);
