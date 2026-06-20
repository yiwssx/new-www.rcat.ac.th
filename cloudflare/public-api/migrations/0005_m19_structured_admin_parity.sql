-- M19 structured admin parity hardening.
-- Additive schema and audit metadata only. This migration contains no data,
-- production binding, remote command, or provider cutover.

PRAGMA foreign_keys = ON;

ALTER TABLE site_settings ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE homepage_settings ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE homepage_settings ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE homepage_settings ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE display_settings ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE display_settings ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE display_settings ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE menu_items ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE carousel_slides ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE carousel_slides ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE carousel_slides ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE external_services ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE external_services ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE external_services ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE events ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER IF NOT EXISTS trg_site_settings_audit_insert
AFTER INSERT ON site_settings
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'site-settings', NEW.id, 'create', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_site_settings_audit_update
AFTER UPDATE ON site_settings
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'site-settings', NEW.id, 'update', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_site_settings_audit_delete
AFTER DELETE ON site_settings
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'site-settings', OLD.id, 'delete', OLD.updated_by, OLD.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_homepage_settings_audit_insert
AFTER INSERT ON homepage_settings
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'homepage-settings', NEW.id, 'create', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_homepage_settings_audit_update
AFTER UPDATE ON homepage_settings
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'homepage-settings', NEW.id, 'update', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_homepage_settings_audit_delete
AFTER DELETE ON homepage_settings
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'homepage-settings', OLD.id, 'delete', OLD.updated_by, OLD.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_display_settings_audit_insert
AFTER INSERT ON display_settings
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'display-settings', NEW.id, 'create', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_display_settings_audit_update
AFTER UPDATE ON display_settings
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'display-settings', NEW.id, 'update', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_display_settings_audit_delete
AFTER DELETE ON display_settings
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'display-settings', OLD.id, 'delete', OLD.updated_by, OLD.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_menu_items_audit_insert
AFTER INSERT ON menu_items
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'menu-item', NEW.id, 'create', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_menu_items_audit_update
AFTER UPDATE ON menu_items
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'menu-item', NEW.id, 'update', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_menu_items_audit_delete
AFTER DELETE ON menu_items
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'menu-item', OLD.id, 'delete', OLD.updated_by, OLD.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_carousel_slides_audit_insert
AFTER INSERT ON carousel_slides
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'carousel-slide', NEW.id, 'create', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_carousel_slides_audit_update
AFTER UPDATE ON carousel_slides
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'carousel-slide', NEW.id, 'update', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_carousel_slides_audit_delete
AFTER DELETE ON carousel_slides
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'carousel-slide', OLD.id, 'delete', OLD.updated_by, OLD.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_external_services_audit_insert
AFTER INSERT ON external_services
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'external-service', NEW.id, 'create', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_external_services_audit_update
AFTER UPDATE ON external_services
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'external-service', NEW.id, 'update', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_external_services_audit_delete
AFTER DELETE ON external_services
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'external-service', OLD.id, 'delete', OLD.updated_by, OLD.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_events_audit_insert
AFTER INSERT ON events
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'event', NEW.id, 'create', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_events_audit_update
AFTER UPDATE ON events
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'event', NEW.id, 'update', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_events_audit_delete
AFTER DELETE ON events
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'event', OLD.id, 'delete', OLD.updated_by, OLD.updated_at, '{}');
END;
