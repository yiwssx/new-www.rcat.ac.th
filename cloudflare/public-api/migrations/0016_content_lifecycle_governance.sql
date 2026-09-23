-- Content lifecycle governance foundation.
-- Additive-only schema for revisions, publication expiry, media accessibility,
-- and audit-query performance. Existing archive/audit tables remain canonical.

PRAGMA foreign_keys = ON;

ALTER TABLE contents ADD COLUMN unpublish_at TEXT NOT NULL DEFAULT '';
ALTER TABLE media_assets ADD COLUMN alt_text TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS content_revisions (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT 'update',
  actor TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (content_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_content_revisions_content_created
  ON content_revisions (content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created
  ON admin_audit_log (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contents_public_expiry
  ON contents (status, publish_at, unpublish_at);

-- Capture only administrative/versioned writes. Public analytics updates view_count
-- without changing revision, so they do not create revision noise.
CREATE TRIGGER IF NOT EXISTS trg_contents_revision_snapshot
BEFORE UPDATE ON contents
WHEN COALESCE(NEW.revision, 0) <> COALESCE(OLD.revision, 0)
BEGIN
  INSERT OR IGNORE INTO content_revisions (
    id,
    content_id,
    revision,
    reason,
    actor,
    snapshot_json,
    created_at
  )
  VALUES (
    'content-rev-' || lower(hex(randomblob(16))),
    OLD.id,
    COALESCE(OLD.revision, 0),
    CASE
      WHEN COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> '' THEN 'delete'
      WHEN OLD.status <> 'published' AND NEW.status = 'published' THEN 'publish'
      WHEN OLD.status = 'published' AND NEW.status <> 'published' THEN 'unpublish'
      ELSE 'update'
    END,
    COALESCE(NEW.updated_by, ''),
    json_object(
      'id', OLD.id,
      'slug', OLD.slug,
      'type', OLD.type,
      'status', OLD.status,
      'owner', COALESCE(OLD.owner, ''),
      'title', OLD.title,
      'summary', OLD.summary,
      'body', OLD.body_snapshot,
      'category', OLD.category,
      'tagsJson', OLD.tags_json,
      'seoTitle', OLD.seo_title,
      'seoDescription', OLD.seo_description,
      'canonicalUrl', OLD.canonical_url,
      'featured', OLD.featured,
      'readingMinutes', OLD.reading_minutes,
      'template', OLD.template,
      'bodyDocId', OLD.body_doc_id,
      'bodyDocUrl', OLD.body_doc_url,
      'featuredMediaId', OLD.featured_media_id,
      'mediaIdsJson', OLD.media_ids_json,
      'publishAt', OLD.publish_at,
      'unpublishAt', COALESCE(OLD.unpublish_at, ''),
      'createdAt', COALESCE(OLD.created_at, ''),
      'createdBy', COALESCE(OLD.created_by, ''),
      'revision', COALESCE(OLD.revision, 0)
    ),
    COALESCE(NEW.updated_at, datetime('now'))
  );
END;
