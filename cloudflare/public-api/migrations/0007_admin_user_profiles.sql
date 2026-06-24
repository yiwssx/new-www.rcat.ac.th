-- Additive Cloudflare admin user profile table.
-- Cloudflare Access remains the identity provider; this table stores app metadata only.
-- No passwords, password hashes, tokens, secrets, or production user data belong here.

CREATE TABLE IF NOT EXISTS app_admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_app_admin_users_email
  ON app_admin_users (email);

CREATE INDEX IF NOT EXISTS idx_app_admin_users_role_status
  ON app_admin_users (role, status);

CREATE TRIGGER IF NOT EXISTS trg_app_admin_users_audit_insert
AFTER INSERT ON app_admin_users
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'admin-user', NEW.id, 'create', NEW.created_by, NEW.created_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_app_admin_users_audit_update
AFTER UPDATE ON app_admin_users
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'admin-user', NEW.id, 'update', NEW.updated_by, NEW.updated_at, '{}');
END;

CREATE TRIGGER IF NOT EXISTS trg_app_admin_users_audit_delete
AFTER DELETE ON app_admin_users
BEGIN
  INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
  VALUES ('audit-' || lower(hex(randomblob(16))), 'admin-user', OLD.id, 'delete', OLD.updated_by, OLD.updated_at, '{}');
END;
