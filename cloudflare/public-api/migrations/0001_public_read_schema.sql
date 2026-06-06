-- M2 public-read schema checkpoint for the isolated Cloudflare Worker.
-- This migration is schema-only: no production data, local seed data, or import
-- output is inserted here.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  media_id TEXT,
  published_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contents (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  summary TEXT NOT NULL DEFAULT '',
  body_json TEXT NOT NULL DEFAULT '[]',
  cover_media_id TEXT,
  owner TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  drive_file_id TEXT,
  drive_url TEXT,
  public_url TEXT,
  alt_text TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  public_site_url TEXT NOT NULL DEFAULT '',
  logo_media_id TEXT,
  contact_json TEXT NOT NULL DEFAULT '{}',
  social_links_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS homepage_settings (
  id TEXT PRIMARY KEY,
  hero_content_id TEXT,
  intro_video_url TEXT,
  director_message_content_id TEXT,
  layout_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS display_settings (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL DEFAULT 'th-TH',
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  time_format TEXT NOT NULL DEFAULT 'HH:mm',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  label TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '',
  content_id TEXT,
  target TEXT NOT NULL DEFAULT '_self',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS carousel_slides (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  image_media_id TEXT,
  image_url TEXT,
  href TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS external_services (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon_url TEXT,
  href TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  start_at TEXT NOT NULL,
  end_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'cancelled')),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visitor_events (
  id TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent_hash TEXT,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visitor_daily_stats (
  stat_date TEXT PRIMARY KEY,
  page_views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_view_events (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_view_daily_stats (
  content_id TEXT NOT NULL,
  stat_date TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  unique_viewers INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (content_id, stat_date)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_public_list
  ON documents (status, pinned DESC, sort_order ASC, published_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_category
  ON documents (status, category, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_contents_public_list
  ON contents (status, content_type, published_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_contents_slug
  ON contents (slug);

CREATE INDEX IF NOT EXISTS idx_media_assets_drive_file_id
  ON media_assets (drive_file_id);

CREATE INDEX IF NOT EXISTS idx_media_assets_public_type
  ON media_assets (media_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_menu_items_public_tree
  ON menu_items (status, parent_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_carousel_slides_public
  ON carousel_slides (enabled, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_external_services_public
  ON external_services (enabled, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_events_public_list
  ON events (status, start_at ASC);

CREATE INDEX IF NOT EXISTS idx_visitor_events_occurred_at
  ON visitor_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_content_view_events_content_at
  ON content_view_events (content_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at
  ON sync_runs (started_at DESC);
