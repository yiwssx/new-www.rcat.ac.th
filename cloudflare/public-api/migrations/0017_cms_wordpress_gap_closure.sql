-- CMS gap-closure foundation: durable slug redirects and opt-in editor content scopes.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS content_redirects (
  old_slug TEXT PRIMARY KEY CHECK (length(trim(old_slug)) > 0),
  new_slug TEXT NOT NULL CHECK (length(trim(new_slug)) > 0),
  content_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (old_slug <> new_slug)
);

CREATE INDEX IF NOT EXISTS idx_content_redirects_new_slug
  ON content_redirects (new_slug);

CREATE INDEX IF NOT EXISTS idx_content_redirects_content_id
  ON content_redirects (content_id);

ALTER TABLE app_admin_users
  ADD COLUMN content_scope TEXT NOT NULL DEFAULT '';

-- Keep all historical slugs pointing directly to the newest canonical slug.
CREATE TRIGGER IF NOT EXISTS trg_contents_slug_redirect_update
AFTER UPDATE OF slug ON contents
WHEN OLD.slug <> NEW.slug
  AND OLD.slug NOT LIKE '__deleted__:%'
  AND NEW.slug NOT LIKE '__deleted__:%'
  AND COALESCE(NEW.deleted_at, '') = ''
BEGIN
  UPDATE content_redirects
  SET new_slug = NEW.slug,
      content_id = NEW.id,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE new_slug = OLD.slug;

  INSERT INTO content_redirects (old_slug, new_slug, content_id, created_at, updated_at)
  VALUES (
    OLD.slug,
    NEW.slug,
    NEW.id,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
  ON CONFLICT(old_slug) DO UPDATE SET
    new_slug = excluded.new_slug,
    content_id = excluded.content_id,
    updated_at = excluded.updated_at;

  DELETE FROM content_redirects WHERE old_slug = NEW.slug;
  DELETE FROM content_redirects WHERE old_slug = new_slug;
END;

-- If a historical slug becomes an active slug again, the active content wins.
CREATE TRIGGER IF NOT EXISTS trg_contents_slug_redirect_insert
AFTER INSERT ON contents
WHEN NEW.slug NOT LIKE '__deleted__:%'
  AND COALESCE(NEW.deleted_at, '') = ''
BEGIN
  DELETE FROM content_redirects WHERE old_slug = NEW.slug;
END;
