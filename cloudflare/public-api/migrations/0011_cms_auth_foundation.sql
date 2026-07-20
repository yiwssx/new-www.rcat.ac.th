-- Phase 1 CMS authentication database foundation.
-- Additive schema only: the legacy shared-password login remains active.

PRAGMA foreign_keys = ON;

ALTER TABLE app_admin_users ADD COLUMN username TEXT;
ALTER TABLE app_admin_users
  ADD COLUMN is_root INTEGER NOT NULL DEFAULT 0 CHECK (is_root IN (0, 1));
ALTER TABLE app_admin_users
  ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1));
ALTER TABLE app_admin_users
  ADD COLUMN mfa_required INTEGER NOT NULL DEFAULT 0 CHECK (mfa_required IN (0, 1));
ALTER TABLE app_admin_users
  ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version >= 1);
ALTER TABLE app_admin_users ADD COLUMN last_login_at TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_admin_users_username_nocase
  ON app_admin_users (username COLLATE NOCASE)
  WHERE username IS NOT NULL
    AND length(trim(username)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_admin_users_single_root
  ON app_admin_users (is_root)
  WHERE is_root = 1;

CREATE TABLE __phase1_0011_root_guard_a7f3c9 (
  active_admin_count INTEGER NOT NULL
    CHECK (active_admin_count BETWEEN 0 AND 1)
);

INSERT INTO __phase1_0011_root_guard_a7f3c9 (active_admin_count)
SELECT COUNT(*)
FROM app_admin_users
WHERE role = 'admin'
  AND status = 'active';

UPDATE app_admin_users
SET is_root = 1
WHERE role = 'admin'
  AND status = 'active';

DROP TABLE __phase1_0011_root_guard_a7f3c9;

CREATE TRIGGER IF NOT EXISTS trg_app_admin_users_root_insert_protect
BEFORE INSERT ON app_admin_users
WHEN NEW.is_root = 1
  AND (NEW.role != 'admin' OR NEW.status != 'active')
BEGIN
  SELECT RAISE(ABORT, 'root administrator is protected');
END;

CREATE TRIGGER IF NOT EXISTS trg_app_admin_users_root_update_protect
BEFORE UPDATE OF is_root, role, status ON app_admin_users
WHEN (
  OLD.is_root = 1
  AND (NEW.is_root != 1 OR NEW.role != 'admin' OR NEW.status != 'active')
)
OR (
  NEW.is_root = 1
  AND (NEW.role != 'admin' OR NEW.status != 'active')
)
BEGIN
  SELECT RAISE(ABORT, 'root administrator is protected');
END;

CREATE TRIGGER IF NOT EXISTS trg_app_admin_users_root_delete_protect
BEFORE DELETE ON app_admin_users
WHEN OLD.is_root = 1
BEGIN
  SELECT RAISE(ABORT, 'root administrator is protected');
END;

CREATE TABLE IF NOT EXISTS admin_credentials (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL CHECK (length(password_hash) > 0),
  password_algorithm TEXT NOT NULL CHECK (length(password_algorithm) BETWEEN 1 AND 32),
  password_changed_at TEXT NOT NULL,
  failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES app_admin_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) > 0),
  csrf_token_hash TEXT NOT NULL CHECK (length(csrf_token_hash) > 0),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  idle_expires_at TEXT NOT NULL,
  absolute_expires_at TEXT NOT NULL,
  session_version INTEGER NOT NULL CHECK (session_version >= 1),
  revoked_at TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  user_agent_hash TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES app_admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user
  ON admin_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_active
  ON admin_sessions (user_id, absolute_expires_at, idle_expires_at)
  WHERE revoked_at = '';

CREATE INDEX IF NOT EXISTS idx_admin_sessions_absolute_expires
  ON admin_sessions (absolute_expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_idle_expires
  ON admin_sessions (idle_expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_revoked_cleanup
  ON admin_sessions (revoked_at)
  WHERE revoked_at != '';

CREATE TABLE IF NOT EXISTS admin_user_invitations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT '',
  revoked_at TEXT NOT NULL DEFAULT '',
  request_ip_hash TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES app_admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_user_invitations_user_active
  ON admin_user_invitations (user_id, expires_at)
  WHERE accepted_at = '' AND revoked_at = '';

CREATE INDEX IF NOT EXISTS idx_admin_user_invitations_expires
  ON admin_user_invitations (expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_user_invitations_unused_cleanup
  ON admin_user_invitations (expires_at, created_at)
  WHERE accepted_at = '' AND revoked_at = '';

CREATE TABLE IF NOT EXISTS admin_password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT '',
  revoked_at TEXT NOT NULL DEFAULT '',
  request_ip_hash TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES app_admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_password_reset_tokens_user_active
  ON admin_password_reset_tokens (user_id, expires_at)
  WHERE used_at = '' AND revoked_at = '';

CREATE INDEX IF NOT EXISTS idx_admin_password_reset_tokens_expires
  ON admin_password_reset_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_password_reset_tokens_completed_cleanup
  ON admin_password_reset_tokens (used_at, revoked_at)
  WHERE used_at != '' OR revoked_at != '';
