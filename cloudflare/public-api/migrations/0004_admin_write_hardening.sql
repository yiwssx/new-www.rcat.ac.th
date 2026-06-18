-- M18 Admin + D1 Write Batch Migration hardening.
-- Additive only: trigger-backed audit logging, no production data, no destructive schema changes.

PRAGMA foreign_keys = ON;

CREATE TRIGGER IF NOT EXISTS trg_contents_admin_audit_insert
AFTER INSERT ON contents
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'content', NEW.id, 'create', NEW.created_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_contents_admin_audit_archive
AFTER UPDATE ON contents
WHEN COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> ''
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'content', NEW.id, 'archive', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_contents_admin_audit_publish
AFTER UPDATE ON contents
WHEN NOT (COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> '')
  AND COALESCE(OLD.deleted_at, '') = COALESCE(NEW.deleted_at, '')
  AND OLD.status <> 'published'
  AND NEW.status = 'published'
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'content', NEW.id, 'publish', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_contents_admin_audit_unpublish
AFTER UPDATE ON contents
WHEN NOT (COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> '')
  AND COALESCE(OLD.deleted_at, '') = COALESCE(NEW.deleted_at, '')
  AND OLD.status = 'published'
  AND NEW.status <> 'published'
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'content', NEW.id, 'unpublish', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_contents_admin_audit_update
AFTER UPDATE ON contents
WHEN NOT (COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> '')
  AND NOT (
    COALESCE(OLD.deleted_at, '') = COALESCE(NEW.deleted_at, '')
    AND OLD.status <> 'published'
    AND NEW.status = 'published'
  )
  AND NOT (
    COALESCE(OLD.deleted_at, '') = COALESCE(NEW.deleted_at, '')
    AND OLD.status = 'published'
    AND NEW.status <> 'published'
  )
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'content', NEW.id, 'update', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_admin_audit_insert
AFTER INSERT ON documents
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'document', NEW.id, 'create', NEW.created_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_admin_audit_archive
AFTER UPDATE ON documents
WHEN COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> ''
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'document', NEW.id, 'archive', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_admin_audit_publish
AFTER UPDATE ON documents
WHEN NOT (COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> '')
  AND COALESCE(OLD.deleted_at, '') = COALESCE(NEW.deleted_at, '')
  AND OLD.status <> 'published'
  AND NEW.status = 'published'
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'document', NEW.id, 'publish', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_admin_audit_unpublish
AFTER UPDATE ON documents
WHEN NOT (COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> '')
  AND COALESCE(OLD.deleted_at, '') = COALESCE(NEW.deleted_at, '')
  AND OLD.status = 'published'
  AND NEW.status <> 'published'
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'document', NEW.id, 'unpublish', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_admin_audit_update
AFTER UPDATE ON documents
WHEN NOT (COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> '')
  AND NOT (
    COALESCE(OLD.deleted_at, '') = COALESCE(NEW.deleted_at, '')
    AND OLD.status <> 'published'
    AND NEW.status = 'published'
  )
  AND NOT (
    COALESCE(OLD.deleted_at, '') = COALESCE(NEW.deleted_at, '')
    AND OLD.status = 'published'
    AND NEW.status <> 'published'
  )
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'document', NEW.id, 'update', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_public_home_sections_admin_audit_insert
AFTER INSERT ON public_home_sections
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES (
    'audit-' || lower(hex(randomblob(16))),
    'home-section',
    NEW.id,
    'create',
    NEW.created_by,
    NEW.updated_at,
    '{}'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_public_home_sections_admin_audit_archive
AFTER UPDATE ON public_home_sections
WHEN COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> ''
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES (
    'audit-' || lower(hex(randomblob(16))),
    'home-section',
    NEW.id,
    'archive',
    NEW.updated_by,
    NEW.updated_at,
    '{}'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_public_home_sections_admin_audit_update
AFTER UPDATE ON public_home_sections
WHEN NOT (COALESCE(OLD.deleted_at, '') = '' AND COALESCE(NEW.deleted_at, '') <> '')
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES (
    'audit-' || lower(hex(randomblob(16))),
    'home-section',
    NEW.id,
    'update',
    NEW.updated_by,
    NEW.updated_at,
    '{}'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_visitor_daily_stats_admin_audit_insert
AFTER INSERT ON visitor_daily_stats
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES (
    'audit-' || lower(hex(randomblob(16))),
    'visitor-daily-stats',
    NEW.day,
    'create',
    NEW.updated_by,
    NEW.updated_at,
    '{}'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_visitor_daily_stats_admin_audit_update
AFTER UPDATE ON visitor_daily_stats
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES (
    'audit-' || lower(hex(randomblob(16))),
    'visitor-daily-stats',
    NEW.day,
    'update',
    NEW.updated_by,
    NEW.updated_at,
    '{}'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_visitor_daily_stats_admin_audit_delete
AFTER DELETE ON visitor_daily_stats
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES (
    'audit-' || lower(hex(randomblob(16))),
    'visitor-daily-stats',
    OLD.day,
    'delete',
    OLD.updated_by,
    OLD.updated_at,
    '{}'
  );
END;
