-- Record committed content states atomically with the authoritative D1 write.
-- Preserve 0016's BEFORE trigger: it captures a legacy pre-image when missing.
-- Existing immutable rows are never rewritten or backfilled. New snapshots include
-- revision zero and the current revision; historical readers must exclude current
-- when they need the previous slug. A failed INSERT aborts the content statement.

PRAGMA foreign_keys = ON;

CREATE TRIGGER IF NOT EXISTS trg_contents_revision_monotonic
BEFORE UPDATE ON contents
WHEN NEW.revision <> OLD.revision AND NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'content revision must advance by one');
END;

CREATE TRIGGER IF NOT EXISTS trg_contents_revision_create
AFTER INSERT ON contents
BEGIN
  INSERT INTO content_revisions (
    id, content_id, revision, reason, actor, snapshot_json, created_at
  ) VALUES (
    'content-rev-' || lower(hex(randomblob(16))),
    NEW.id,
    NEW.revision,
    'create',
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
      'revision', COALESCE(NEW.revision, 0),
      'deletedAt', COALESCE(NEW.deleted_at, ''),
      'updatedAt', NEW.updated_at,
      'updatedBy', NEW.updated_by
    ),
    NEW.updated_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_contents_revision_write
AFTER UPDATE ON contents
WHEN NEW.revision <> OLD.revision
BEGIN
  INSERT INTO content_revisions (
    id, content_id, revision, reason, actor, snapshot_json, created_at
  ) VALUES (
    'content-rev-' || lower(hex(randomblob(16))),
    NEW.id,
    NEW.revision,
    CASE
      WHEN COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> '' THEN 'delete'
      WHEN COALESCE(OLD.deleted_at, '') <> '' AND COALESCE(NEW.deleted_at, '') = '' THEN 'restore'
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
      'revision', COALESCE(NEW.revision, 0),
      'deletedAt', COALESCE(NEW.deleted_at, ''),
      'updatedAt', NEW.updated_at,
      'updatedBy', NEW.updated_by
    ),
    NEW.updated_at
  );
END;
