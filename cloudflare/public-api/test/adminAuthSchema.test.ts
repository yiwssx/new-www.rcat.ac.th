import { describe, expect, it } from "vitest";
import migrationSql from "../migrations/0011_cms_auth_foundation.sql?raw";
import identityConstraintsMigrationSql from "../migrations/0012_cms_auth_identity_constraints.sql?raw";
import adminUserProfileMigrationSql from "../migrations/0007_admin_user_profiles.sql?raw";
import adminPaginationSource from "../src/routes/adminPagination.ts?raw";
import {
  ADMIN_AUTH_USER_ROW_COLUMNS,
  ADMIN_CREDENTIAL_ROW_COLUMNS,
  ADMIN_PASSWORD_RESET_TOKEN_ROW_COLUMNS,
  ADMIN_SESSION_ROW_COLUMNS,
  ADMIN_USER_INVITATION_ROW_COLUMNS,
  ADMIN_USER_ROW_COLUMNS
} from "../src/db/schema";

const migrationFileName = "0011_cms_auth_foundation.sql";
const identityConstraintsMigrationFileName = "0012_cms_auth_identity_constraints.sql";
const rootGuardTable = "__phase1_0011_root_guard_a7f3c9";
const emailGuardTable = "__phase2_0012_email_nocase_guard_6e41b8";
const existingAdminUserColumns = [
  "id",
  "email",
  "name",
  "role",
  "status",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "revision"
] as const;
const addedAdminUserColumns = [
  "username",
  "is_root",
  "must_change_password",
  "mfa_required",
  "session_version",
  "last_login_at"
] as const;
const expectedColumnsByTable = {
  admin_credentials: [
    "user_id",
    "password_hash",
    "password_algorithm",
    "password_changed_at",
    "failed_login_count",
    "locked_until",
    "created_at",
    "updated_at"
  ],
  admin_sessions: [
    "id",
    "user_id",
    "token_hash",
    "csrf_token_hash",
    "created_at",
    "last_seen_at",
    "idle_expires_at",
    "absolute_expires_at",
    "session_version",
    "revoked_at",
    "ip_hash",
    "user_agent_hash"
  ],
  admin_user_invitations: [
    "id",
    "user_id",
    "token_hash",
    "created_by",
    "created_at",
    "expires_at",
    "accepted_at",
    "revoked_at",
    "request_ip_hash"
  ],
  admin_password_reset_tokens: [
    "id",
    "user_id",
    "token_hash",
    "created_at",
    "expires_at",
    "used_at",
    "revoked_at",
    "request_ip_hash"
  ]
} as const;
const internalColumnContracts = {
  admin_credentials: ADMIN_CREDENTIAL_ROW_COLUMNS,
  admin_sessions: ADMIN_SESSION_ROW_COLUMNS,
  admin_user_invitations: ADMIN_USER_INVITATION_ROW_COLUMNS,
  admin_password_reset_tokens: ADMIN_PASSWORD_RESET_TOKEN_ROW_COLUMNS
} as const;
const requiredIndexNames = [
  "idx_app_admin_users_username_nocase",
  "idx_app_admin_users_single_root",
  "idx_admin_sessions_user",
  "idx_admin_sessions_user_active",
  "idx_admin_sessions_absolute_expires",
  "idx_admin_sessions_idle_expires",
  "idx_admin_sessions_revoked_cleanup",
  "idx_admin_user_invitations_user_active",
  "idx_admin_user_invitations_expires",
  "idx_admin_user_invitations_unused_cleanup",
  "idx_admin_password_reset_tokens_user_active",
  "idx_admin_password_reset_tokens_expires",
  "idx_admin_password_reset_tokens_completed_cleanup"
] as const;

function getCreateTableBody(sql: string, tableName: string) {
  return new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${tableName}\\s*\\(([\\s\\S]*?)\\);`, "i").exec(sql)?.[1] ?? "";
}

function getTableColumns(sql: string, tableName: string) {
  return getCreateTableBody(sql, tableName)
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .filter((line) => !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(line))
    .map((line) => line.split(/\s+/)[0].replaceAll('"', ""));
}

function getAddedColumns(sql: string, tableName: string) {
  return Array.from(
    sql.matchAll(new RegExp(`ALTER TABLE\\s+${tableName}\\s+ADD COLUMN\\s+([a-z_]+)`, "gi")),
    (match) => match[1]
  );
}

function getUserListSource() {
  return /const USER_LIST_COLUMNS = \[([\s\S]*?)\] as const/.exec(adminPaginationSource)?.[1] ?? "";
}

describe("Phase 1 CMS authentication schema foundation", () => {
  it("uses additive migration 0011 without recreating or destructively changing app_admin_users", () => {
    expect(migrationFileName).toBe("0011_cms_auth_foundation.sql");
    expect(getTableColumns(adminUserProfileMigrationSql, "app_admin_users")).toEqual(existingAdminUserColumns);
    expect(ADMIN_USER_ROW_COLUMNS).toEqual(existingAdminUserColumns);
    expect(getAddedColumns(migrationSql, "app_admin_users")).toEqual(addedAdminUserColumns);
    expect(migrationSql).not.toMatch(/CREATE TABLE(?: IF NOT EXISTS)?\s+app_admin_users\b/i);
    expect(migrationSql).not.toMatch(/DROP TABLE\s+app_admin_users\b/i);
    expect(migrationSql).not.toMatch(/ALTER TABLE\s+app_admin_users\s+(?:DROP|RENAME)\b/i);
  });

  it("adds nullable username and checked root, password-policy, MFA, and session metadata", () => {
    expect(migrationSql).toMatch(/ADD COLUMN\s+username\s+TEXT\s*;/i);
    expect(migrationSql).not.toMatch(/ADD COLUMN\s+username\s+TEXT\s+NOT NULL/i);
    expect(migrationSql).toMatch(/is_root[^;]+CHECK\s*\(is_root IN \(0, 1\)\)/i);
    expect(migrationSql).toMatch(/must_change_password[^;]+CHECK\s*\(must_change_password IN \(0, 1\)\)/i);
    expect(migrationSql).toMatch(/mfa_required[^;]+CHECK\s*\(mfa_required IN \(0, 1\)\)/i);
    expect(migrationSql).toMatch(/session_version[^;]+CHECK\s*\(session_version >= 1\)/i);
    expect(ADMIN_AUTH_USER_ROW_COLUMNS).toEqual([...existingAdminUserColumns, ...addedAdminUserColumns]);
  });

  it("creates all four auth tables with TypeScript column contracts matching the migration", () => {
    Object.entries(expectedColumnsByTable).forEach(([tableName, expectedColumns]) => {
      expect(migrationSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${tableName}\\b`, "i"));
      expect(getTableColumns(migrationSql, tableName)).toEqual(expectedColumns);
      expect(internalColumnContracts[tableName as keyof typeof internalColumnContracts]).toEqual(expectedColumns);
    });
  });

  it("keeps app_admin_users as the parent and cascades dependent auth data for normal users", () => {
    const foreignKeys = migrationSql.match(
      /FOREIGN KEY\s*\(user_id\)\s+REFERENCES\s+app_admin_users\s*\(id\)\s+ON DELETE CASCADE/gi
    );

    expect(foreignKeys).toHaveLength(4);
    expect(migrationSql).not.toMatch(/ALTER TABLE\s+app_admin_users[^;]+REFERENCES\s+admin_/i);
  });

  it("creates partial uniqueness and access-pattern indexes", () => {
    requiredIndexNames.forEach((indexName) => {
      expect(migrationSql).toMatch(new RegExp(`CREATE (?:UNIQUE )?INDEX IF NOT EXISTS\\s+${indexName}\\b`, "i"));
    });
    expect(migrationSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS\s+idx_app_admin_users_username_nocase[\s\S]+username COLLATE NOCASE[\s\S]+WHERE username IS NOT NULL[\s\S]+length\(trim\(username\)\) > 0;/i
    );
    expect(migrationSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS\s+idx_app_admin_users_single_root[\s\S]+ON app_admin_users\s*\(is_root\)[\s\S]+WHERE is_root = 1;/i
    );
  });

  it("guards root designation deterministically for zero or one active administrator", () => {
    expect(migrationSql).toMatch(
      new RegExp(
        `CREATE TABLE\\s+${rootGuardTable}\\s*\\([\\s\\S]+CHECK\\s*\\(active_admin_count BETWEEN 0 AND 1\\)`,
        "i"
      )
    );
    expect(migrationSql).toMatch(/SELECT COUNT\(\*\)[\s\S]+WHERE role = 'admin'[\s\S]+AND status = 'active';/i);
    expect(migrationSql).toMatch(
      /UPDATE app_admin_users[\s\S]+SET is_root = 1[\s\S]+WHERE role = 'admin'[\s\S]+AND status = 'active';/i
    );
    expect(migrationSql).toMatch(new RegExp(`DROP TABLE\\s+${rootGuardTable};`, "i"));
    expect(migrationSql).not.toMatch(/ORDER BY[\s\S]*LIMIT\s+1/i);
  });

  it("protects root deletion, demotion, disablement, and root-flag removal", () => {
    expect(migrationSql).toMatch(
      /CREATE TRIGGER IF NOT EXISTS\s+trg_app_admin_users_root_delete_protect[\s\S]+BEFORE DELETE ON app_admin_users[\s\S]+OLD\.is_root = 1/i
    );
    expect(migrationSql).toMatch(
      /CREATE TRIGGER IF NOT EXISTS\s+trg_app_admin_users_root_update_protect[\s\S]+BEFORE UPDATE OF is_root, role, status ON app_admin_users[\s\S]+OLD\.is_root = 1[\s\S]+NEW\.is_root != 1[\s\S]+NEW\.role != 'admin'[\s\S]+NEW\.status != 'active'/i
    );
    expect(migrationSql).toMatch(
      /CREATE TRIGGER IF NOT EXISTS\s+trg_app_admin_users_root_insert_protect[\s\S]+NEW\.is_root = 1[\s\S]+NEW\.role != 'admin'[\s\S]+NEW\.status != 'active'/i
    );
    expect(migrationSql.match(/root administrator is protected/g)).toHaveLength(3);
  });

  it("does not seed credentials, sessions, invitations, reset tokens, passwords, or real identities", () => {
    const insertTargets = Array.from(migrationSql.matchAll(/INSERT INTO\s+([a-z0-9_]+)/gi), (match) => match[1]);
    const updateTargets = Array.from(migrationSql.matchAll(/^\s*UPDATE\s+([a-z0-9_]+)/gim), (match) => match[1]);

    expect(insertTargets).toEqual([rootGuardTable]);
    expect(updateTargets).toEqual(["app_admin_users"]);
    expect(migrationSql).not.toMatch(
      /INSERT INTO\s+admin_(?:credentials|sessions|user_invitations|password_reset_tokens)\b/i
    );
    expect(migrationSql).not.toMatch(/ADMIN_PROXY_(?:PASSWORD_HASH|SESSION_SECRET|ALLOWED_EMAILS)/i);
    expect(migrationSql).not.toMatch(/\$2[aby]\$|argon2|@rcat\.ac\.th/i);
    expect(migrationSql).not.toMatch(/\b(?:password|token|csrf_token|request_ip|ip|user_agent)\s+TEXT\b/i);
  });

  it("keeps sensitive auth fields out of the current user-list API", () => {
    const userListSource = getUserListSource();
    const forbiddenUserListColumns = [
      "password_hash",
      "token_hash",
      "csrf_token_hash",
      "request_ip_hash",
      "ip_hash",
      "user_agent_hash"
    ];

    expect(userListSource).not.toBe("");
    forbiddenUserListColumns.forEach((columnName) => {
      expect(userListSource).not.toContain(columnName);
      expect(ADMIN_USER_ROW_COLUMNS).not.toContain(columnName);
    });
  });

  it("uses hash-oriented names for every stored token and request identifier", () => {
    const sensitiveColumns = Object.values(expectedColumnsByTable)
      .flat()
      .filter((columnName) => /token|csrf|request_ip|user_agent|^ip_/.test(columnName));

    expect(sensitiveColumns).toEqual([
      "token_hash",
      "csrf_token_hash",
      "ip_hash",
      "user_agent_hash",
      "token_hash",
      "request_ip_hash",
      "token_hash",
      "request_ip_hash"
    ]);
    sensitiveColumns.forEach((columnName) => expect(columnName).toMatch(/_hash$/));
  });
});

describe("Phase 2 CMS authentication identity constraints", () => {
  it("uses additive migration number 0012 and creates the case-insensitive email index", () => {
    expect(identityConstraintsMigrationFileName).toBe("0012_cms_auth_identity_constraints.sql");
    expect(identityConstraintsMigrationSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS\s+idx_app_admin_users_email_nocase\s+ON app_admin_users\s*\(email COLLATE NOCASE\)/i
    );
    expect(identityConstraintsMigrationSql).not.toMatch(/CREATE TABLE(?: IF NOT EXISTS)?\s+app_admin_users\b/i);
    expect(identityConstraintsMigrationSql).not.toMatch(/ALTER TABLE\s+app_admin_users\b/i);
  });

  it("aborts deterministically when case-insensitive duplicate email groups exist", () => {
    expect(identityConstraintsMigrationSql).toMatch(
      new RegExp(`CREATE TABLE\\s+${emailGuardTable}\\s*\\([\\s\\S]+CHECK\\s*\\(duplicate_group_count = 0\\)`, "i")
    );
    expect(identityConstraintsMigrationSql).toMatch(
      /SELECT COUNT\(\*\)[\s\S]+SELECT email[\s\S]+GROUP BY email COLLATE NOCASE[\s\S]+HAVING COUNT\(\*\) > 1/i
    );
    expect(identityConstraintsMigrationSql).toMatch(new RegExp(`DROP TABLE\\s+${emailGuardTable};`, "i"));
    expect(identityConstraintsMigrationSql).not.toMatch(/LIMIT\s+1/i);
  });

  it("does not delete, merge, select, or rewrite user identities", () => {
    expect(identityConstraintsMigrationSql).not.toMatch(/DELETE\s+FROM\s+app_admin_users/i);
    expect(identityConstraintsMigrationSql).not.toMatch(/UPDATE\s+app_admin_users/i);
    expect(identityConstraintsMigrationSql).not.toMatch(/LOWER\s*\(email\)|SET\s+email/i);
    expect(identityConstraintsMigrationSql).not.toMatch(/(?:MERGE|REPLACE)\s+(?:INTO\s+)?app_admin_users/i);
  });

  it("does not alter credential, Session, invitation, or reset-token data", () => {
    expect(identityConstraintsMigrationSql).not.toMatch(
      /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?admin_(?:credentials|sessions|user_invitations|password_reset_tokens)\b/i
    );
    expect(identityConstraintsMigrationSql).not.toMatch(/CREATE\s+TABLE\s+(?:IF NOT EXISTS\s+)?admin_/i);
  });

  it("embeds no password, token, hash, environment value, or real identity", () => {
    expect(identityConstraintsMigrationSql).not.toMatch(/ADMIN_PROXY_|\$2[aby]\$|@|password|token|session_secret/i);
  });

  it("leaves the Phase 1 migration contract at 0011", () => {
    expect(migrationFileName).toBe("0011_cms_auth_foundation.sql");
    expect(migrationSql).toContain("Phase 1 CMS authentication database foundation");
    expect(migrationSql).not.toContain("idx_app_admin_users_email_nocase");
  });
});
