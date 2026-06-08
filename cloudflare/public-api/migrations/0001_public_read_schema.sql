-- M2.1 public-read schema checkpoint for the isolated Cloudflare Worker.
-- This migration is schema-only and compatibility-first. No production data,
-- local seed data, or import output is inserted here.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  media_id TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS contents (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body_snapshot TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  canonical_url TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  reading_minutes INTEGER NOT NULL DEFAULT 0,
  template TEXT NOT NULL DEFAULT '',
  body_doc_id TEXT NOT NULL DEFAULT '',
  body_doc_url TEXT NOT NULL DEFAULT '',
  featured_media_id TEXT NOT NULL DEFAULT '',
  media_ids_json TEXT NOT NULL DEFAULT '[]',
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  publish_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  drive_url TEXT NOT NULL DEFAULT '',
  file_id TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  preview_url TEXT NOT NULL DEFAULT '',
  embed_url TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS homepage_settings (
  id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS display_settings (
  id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  children_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS carousel_slides (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  chip TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  button_label TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  start_at TEXT NOT NULL DEFAULT '',
  end_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS external_services (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'general',
  icon_key TEXT NOT NULL DEFAULT 'link',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  end_date TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'public',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS visitor_events (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer_origin TEXT NOT NULL DEFAULT '',
  page_title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visitor_daily_stats (
  day TEXT PRIMARY KEY,
  total_views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  online_users INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS content_view_events (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_view_daily_stats (
  day TEXT NOT NULL,
  content_id TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  view_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (day, content_id)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL DEFAULT '',
  records_read INTEGER NOT NULL DEFAULT 0,
  records_written INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_documents_public_order
  ON documents (status, pinned, sort_order, published_at);

CREATE INDEX IF NOT EXISTS idx_documents_media_id
  ON documents (media_id);

CREATE INDEX IF NOT EXISTS idx_contents_public_list
  ON contents (status, type, publish_at);

CREATE INDEX IF NOT EXISTS idx_contents_slug
  ON contents (slug);

CREATE INDEX IF NOT EXISTS idx_contents_featured
  ON contents (status, featured, publish_at);

CREATE INDEX IF NOT EXISTS idx_media_assets_file_id
  ON media_assets (file_id);

CREATE INDEX IF NOT EXISTS idx_media_assets_type
  ON media_assets (type);

CREATE INDEX IF NOT EXISTS idx_media_assets_updated_at
  ON media_assets (updated_at);

CREATE INDEX IF NOT EXISTS idx_menu_items_parent_order
  ON menu_items (parent_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_menu_items_enabled_order
  ON menu_items (enabled, sort_order);

CREATE INDEX IF NOT EXISTS idx_carousel_slides_enabled_order
  ON carousel_slides (enabled, sort_order);

CREATE INDEX IF NOT EXISTS idx_external_services_enabled_order
  ON external_services (enabled, sort_order);

CREATE INDEX IF NOT EXISTS idx_events_public_date
  ON events (visibility, status, date);

CREATE INDEX IF NOT EXISTS idx_visitor_events_created_at
  ON visitor_events (created_at);

CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor_created
  ON visitor_events (visitor_id, created_at);

CREATE INDEX IF NOT EXISTS idx_visitor_events_path_created
  ON visitor_events (path, created_at);

CREATE INDEX IF NOT EXISTS idx_content_view_events_content_created
  ON content_view_events (content_id, created_at);

CREATE INDEX IF NOT EXISTS idx_content_view_events_slug_created
  ON content_view_events (slug, created_at);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at
  ON sync_runs (started_at);

CREATE INDEX IF NOT EXISTS idx_sync_runs_source_started
  ON sync_runs (source, started_at);
