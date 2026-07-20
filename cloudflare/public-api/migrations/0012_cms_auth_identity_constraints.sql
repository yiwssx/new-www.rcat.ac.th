-- Phase 2 CMS authentication identity constraints.
-- Additive only: credentials remain unconfigured until the authenticated Root bootstrap.

CREATE TABLE __phase2_0012_email_nocase_guard_6e41b8 (
  duplicate_group_count INTEGER NOT NULL
    CHECK (duplicate_group_count = 0)
);

INSERT INTO __phase2_0012_email_nocase_guard_6e41b8 (duplicate_group_count)
SELECT COUNT(*)
FROM (
  SELECT email
  FROM app_admin_users
  GROUP BY email COLLATE NOCASE
  HAVING COUNT(*) > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_admin_users_email_nocase
  ON app_admin_users (email COLLATE NOCASE);

DROP TABLE __phase2_0012_email_nocase_guard_6e41b8;
