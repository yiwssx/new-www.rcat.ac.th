-- Phase 6 CMS MFA, recovery-code, and reauthentication foundation.
-- Additive only. Existing CMS sessions remain password-assured and are
-- invalidated by application policy when MFA is effective for their user.

PRAGMA foreign_keys = ON;

ALTER TABLE admin_sessions ADD COLUMN reauthenticated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE admin_sessions ADD COLUMN mfa_verified_at TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS admin_mfa_totp (
  user_id TEXT PRIMARY KEY,
  encrypted_secret TEXT NOT NULL CHECK (length(encrypted_secret) > 0),
  iv TEXT NOT NULL CHECK (length(iv) > 0),
  key_version TEXT NOT NULL CHECK (length(key_version) BETWEEN 1 AND 32),
  state TEXT NOT NULL CHECK (state IN ('pending', 'enabled')),
  created_at TEXT NOT NULL,
  enabled_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  last_used_step INTEGER NOT NULL DEFAULT -1 CHECK (last_used_step >= -1),
  FOREIGN KEY (user_id) REFERENCES app_admin_users(id) ON DELETE CASCADE,
  CHECK (
    (state = 'pending' AND enabled_at = '')
    OR (state = 'enabled' AND enabled_at != '')
  )
);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_totp_state
  ON admin_mfa_totp (state, updated_at);

CREATE TABLE IF NOT EXISTS admin_mfa_recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE CHECK (length(code_hash) > 0),
  created_at TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES app_admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_codes_user
  ON admin_mfa_recovery_codes (user_id, used_at);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_codes_unused
  ON admin_mfa_recovery_codes (user_id, created_at)
  WHERE used_at = '';

CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_codes_used_cleanup
  ON admin_mfa_recovery_codes (used_at)
  WHERE used_at != '';

CREATE TABLE IF NOT EXISTS admin_mfa_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) > 0),
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'enrollment')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT '',
  revoked_at TEXT NOT NULL DEFAULT '',
  failed_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempt_count BETWEEN 0 AND 5),
  user_session_version INTEGER NOT NULL CHECK (user_session_version >= 1),
  ip_hash TEXT NOT NULL DEFAULT '',
  user_agent_hash TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES app_admin_users(id) ON DELETE CASCADE,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_challenges_user_active
  ON admin_mfa_challenges (user_id, purpose, expires_at)
  WHERE consumed_at = '' AND revoked_at = '';

CREATE INDEX IF NOT EXISTS idx_admin_mfa_challenges_token_active
  ON admin_mfa_challenges (token_hash)
  WHERE consumed_at = '' AND revoked_at = '';

CREATE INDEX IF NOT EXISTS idx_admin_mfa_challenges_expires
  ON admin_mfa_challenges (expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_challenges_cleanup
  ON admin_mfa_challenges (consumed_at, revoked_at)
  WHERE consumed_at != '' OR revoked_at != '';
