-- Revision history write-boundary hardening.
-- Keep revision evidence in the same D1 statement as the authoritative content
-- mutation so a revision-write failure aborts the content write instead of
-- silently losing history.

PRAGMA foreign_keys = ON;

-- Migration 0016 captured the pre-update state with INSERT OR IGNORE. Replace
-- that trigger so every successful versioned mutation records the resulting
-- immutable state and any revision conflict fails the statement closed.
DROP TRIGGER IF EXISTS trg_contents_revision_snapshot;

CREATE TRIGGER IF NOT EXISTS trg_contents_revision_snapshot_insert
AFTER INSERT ON contents
BEGIN
  INSERT INTO content_revisions (
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
    NEW.id,
    COALESCE(NEW.revision, 0),
    'create',
    COALESCE(NULLIF(NEW.updated_by, ''), NULLIF(NEW.created_by, ''), ''),
    json_object(
      'id', NEW.id,
      'slug', NEW.slug,
      'type', NEW.type,
      'status', NEW.status,
      'owner', COALESCE(NEW.owner, ''),
      'title', NEW.title,
      'summary', NEW.summary,
      'body', NEW.body_snapshot,
      'category', NEW.category,
      'tagsJson', NEW.tags_json,
      'seoTitle', NEW.seo_title,
      'seoDescription', NEW.seo_description,
      'canonicalUrl', NEW.canonical_url,
      'featured', NEW.featured,
      'readingMinutes', NEW.reading_minutes,
      'template', NEW.template,
      'bodyDocId', NEW.body_doc_id,
      'bodyDocUrl', NEW.body_doc_url,
      'featuredMediaId', NEW.featured_media_id,
      'mediaIdsJson', NEW.media_ids_json,
      'publishAt', NEW.publish_at,
      'unpublishAt', COALESCE(NEW.unpublish_at, ''),
      'createdAt', COALESCE(NEW.created_at, ''),
      'createdBy', COALESCE(NEW.created_by, ''),
      'revision', COALESCE(NEW.revision, 0)
    ),
    COALESCE(NULLIF(NEW.updated_at, ''), NULLIF(NEW.created_at, ''), datetime('now'))
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_contents_revision_snapshot_update
AFTER UPDATE ON contents
WHEN COALESCE(NEW.revision, 0) <> COALESCE(OLD.revision, 0)
BEGIN
  INSERT INTO content_revisions (
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
    NEW.id,
    COALESCE(NEW.revision, 0),
    CASE
      WHEN COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> '' THEN 'delete'
      WHEN OLD.status <> 'published' AND NEW.status = 'published' THEN 'publish'
      WHEN OLD.status = 'published' AND NEW.status <> 'published' THEN 'unpublish'
      ELSE 'update'
    END,
    COALESCE(NEW.updated_by, ''),
    json_object(
      'id', NEW.id,
      'slug', NEW.slug,
      'type', NEW.type,
      'status', NEW.status,
      'owner', COALESCE(NEW.owner, ''),
      'title', NEW.title,
      'summary', NEW.summary,
      'body', NEW.body_snapshot,
      'category', NEW.category,
      'tagsJson', NEW.tags_json,
      'seoTitle', NEW.seo_title,
      'seoDescription', NEW.seo_description,
      'canonicalUrl', NEW.canonical_url,
      'featured', NEW.featured,
      'readingMinutes', NEW.reading_minutes,
      'template', NEW.template,
      'bodyDocId', NEW.body_doc_id,
      'bodyDocUrl', NEW.body_doc_url,
      'featuredMediaId', NEW.featured_media_id,
      'mediaIdsJson', NEW.media_ids_json,
      'publishAt', NEW.publish_at,
      'unpublishAt', COALESCE(NEW.unpublish_at, ''),
      'createdAt', COALESCE(NEW.created_at, ''),
      'createdBy', COALESCE(NEW.created_by, ''),
      'revision', COALESCE(NEW.revision, 0)
    ),
    COALESCE(NULLIF(NEW.updated_at, ''), datetime('now'))
  );
END;
