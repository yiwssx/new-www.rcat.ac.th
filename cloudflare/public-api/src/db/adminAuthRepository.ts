import { requireD1Database } from "./documentsRepository";
import {
  ADMIN_AUDIT_LOG_ROW_COLUMNS,
  ADMIN_AUTH_USER_ROW_COLUMNS,
  ADMIN_CREDENTIAL_ROW_COLUMNS,
  type AdminAuthUserRow,
  type AdminAuditLogRow,
  type AdminCredentialRow
} from "./schema";
import type { Env } from "../env";

export const CMS_IDENTIFIER_MAX_LENGTH = 320;

export interface FailedPasswordAttemptState {
  failedLoginCount: number;
  lockedUntil: string;
}

export interface InitialRootCredentialInput {
  rootUserId: string;
  passwordHash: string;
  passwordAlgorithm: string;
  username: string | null;
  updateUsername: boolean;
  actor: string;
  now: Date;
}

export type AdminAuthRepositoryConflictCode = "credential_configured" | "duplicate_username" | "root_unavailable";

export class AdminAuthRepositoryConflict extends Error {
  constructor(readonly code: AdminAuthRepositoryConflictCode) {
    super(code);
    this.name = "AdminAuthRepositoryConflict";
    Object.setPrototypeOf(this, AdminAuthRepositoryConflict.prototype);
  }
}

export interface AdminAuthRepository {
  findAuthenticationUsersByIdentifier(identifier: string): Promise<AdminAuthUserRow[]>;
  findAuthenticationUsersByUsername(username: string): Promise<AdminAuthUserRow[]>;
  getCredentialByUserId(userId: string): Promise<AdminCredentialRow | null>;
  getProtectedRootAccounts(): Promise<AdminAuthUserRow[]>;
  rootHasCredential(userId: string): Promise<boolean>;
  createInitialRootCredential(input: InitialRootCredentialInput): Promise<void>;
  recordFailedPasswordAttempt(userId: string, now: Date): Promise<FailedPasswordAttemptState | null>;
  clearFailedPasswordAttempts(userId: string, now: Date): Promise<void>;
  writeSecurityAuditEntry(entry: AdminAuditLogRow): Promise<void>;
}

export function normalizeCmsIdentifier(identifier: unknown) {
  if (typeof identifier !== "string") {
    return null;
  }

  const normalized = identifier.trim().toLowerCase();

  if (normalized.length === 0 || normalized.length > CMS_IDENTIFIER_MAX_LENGTH) {
    return null;
  }

  return normalized;
}

export function getCmsLockoutDurationSeconds(failureCount: number) {
  if (failureCount < 5) {
    return 0;
  }

  if (failureCount === 5) {
    return 30;
  }

  if (failureCount === 6) {
    return 2 * 60;
  }

  if (failureCount === 7) {
    return 15 * 60;
  }

  if (failureCount < 10) {
    return 30 * 60;
  }

  return 60 * 60;
}

function lockTimestamp(now: Date, failureCount: number) {
  const durationSeconds = getCmsLockoutDurationSeconds(failureCount);
  return durationSeconds === 0 ? "" : new Date(now.getTime() + durationSeconds * 1000).toISOString();
}

function classifyBootstrapError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);

  if (/NOT NULL constraint failed:\s*admin_credentials\.password_hash/i.test(message)) {
    throw new AdminAuthRepositoryConflict("root_unavailable");
  }

  if (/idx_app_admin_users_username_nocase|app_admin_users\.username/i.test(message)) {
    throw new AdminAuthRepositoryConflict("duplicate_username");
  }

  if (/UNIQUE constraint failed:\s*admin_credentials\.user_id|admin_credentials_user_id/i.test(message)) {
    throw new AdminAuthRepositoryConflict("credential_configured");
  }

  throw error;
}

export function createAdminAuthRepository(env: Env): AdminAuthRepository {
  const db = requireD1Database(env);

  return {
    async findAuthenticationUsersByIdentifier(identifier) {
      const normalized = normalizeCmsIdentifier(identifier);

      if (!normalized) {
        return [];
      }

      const result = await db
        .prepare(
          `SELECT ${ADMIN_AUTH_USER_ROW_COLUMNS.join(", ")}
           FROM app_admin_users
           WHERE email = ? COLLATE NOCASE
              OR username = ? COLLATE NOCASE`
        )
        .bind(normalized, normalized)
        .all<AdminAuthUserRow>();

      return result.results ?? [];
    },

    async findAuthenticationUsersByUsername(username) {
      const normalized = normalizeCmsIdentifier(username);

      if (!normalized) {
        return [];
      }

      const result = await db
        .prepare(
          `SELECT ${ADMIN_AUTH_USER_ROW_COLUMNS.join(", ")}
           FROM app_admin_users
           WHERE username = ? COLLATE NOCASE`
        )
        .bind(normalized)
        .all<AdminAuthUserRow>();

      return result.results ?? [];
    },

    async getCredentialByUserId(userId) {
      return db
        .prepare(
          `SELECT ${ADMIN_CREDENTIAL_ROW_COLUMNS.join(", ")}
           FROM admin_credentials
           WHERE user_id = ?`
        )
        .bind(userId)
        .first<AdminCredentialRow>();
    },

    async getProtectedRootAccounts() {
      const result = await db
        .prepare(
          `SELECT ${ADMIN_AUTH_USER_ROW_COLUMNS.join(", ")}
           FROM app_admin_users
           WHERE is_root = 1`
        )
        .all<AdminAuthUserRow>();

      return result.results ?? [];
    },

    async rootHasCredential(userId) {
      const row = await db
        .prepare("SELECT user_id FROM admin_credentials WHERE user_id = ?")
        .bind(userId)
        .first<{ user_id: string }>();
      return Boolean(row);
    },

    async createInitialRootCredential(input) {
      const now = input.now.toISOString();
      const auditEntry: AdminAuditLogRow = {
        id: `admin-audit-${crypto.randomUUID()}`,
        entity_type: "admin-user",
        entity_id: input.rootUserId,
        action: "credential.bootstrap",
        actor: input.actor,
        created_at: now,
        metadata_json: JSON.stringify({ algorithm: input.passwordAlgorithm, root: true })
      };

      try {
        await db.batch([
          db
            .prepare(
              `INSERT INTO admin_credentials (${ADMIN_CREDENTIAL_ROW_COLUMNS.join(", ")})
               VALUES (
                 ?,
                 CASE WHEN EXISTS (
                   SELECT 1
                   FROM app_admin_users
                   WHERE id = ?
                     AND is_root = 1
                     AND role = 'admin'
                     AND status = 'active'
                 ) THEN ? ELSE NULL END,
                 ?, ?, 0, '', ?, ?
               )`
            )
            .bind(input.rootUserId, input.rootUserId, input.passwordHash, input.passwordAlgorithm, now, now, now),
          db
            .prepare(
              `UPDATE app_admin_users
               SET username = CASE WHEN ? = 1 THEN ? ELSE username END,
                   must_change_password = 0,
                   updated_at = ?,
                   updated_by = ?,
                   revision = revision + 1
               WHERE id = ?
                 AND is_root = 1
                 AND role = 'admin'
                 AND status = 'active'`
            )
            .bind(input.updateUsername ? 1 : 0, input.username, now, input.actor, input.rootUserId),
          db
            .prepare(
              `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
               VALUES (${ADMIN_AUDIT_LOG_ROW_COLUMNS.map(() => "?").join(", ")})`
            )
            .bind(...ADMIN_AUDIT_LOG_ROW_COLUMNS.map((column) => auditEntry[column]))
        ]);
      } catch (error) {
        classifyBootstrapError(error);
      }
    },

    async recordFailedPasswordAttempt(userId, now) {
      const nowIso = now.toISOString();
      const result = await db
        .prepare(
          `UPDATE admin_credentials
           SET failed_login_count = failed_login_count + 1,
               locked_until = CASE failed_login_count + 1
                 WHEN 5 THEN ?
                 WHEN 6 THEN ?
                 WHEN 7 THEN ?
                 WHEN 8 THEN ?
                 WHEN 9 THEN ?
                 ELSE CASE WHEN failed_login_count + 1 >= 10 THEN ? ELSE '' END
               END,
               updated_at = ?
           WHERE user_id = ?
           RETURNING failed_login_count, locked_until`
        )
        .bind(
          lockTimestamp(now, 5),
          lockTimestamp(now, 6),
          lockTimestamp(now, 7),
          lockTimestamp(now, 8),
          lockTimestamp(now, 9),
          lockTimestamp(now, 10),
          nowIso,
          userId
        )
        .run<Pick<AdminCredentialRow, "failed_login_count" | "locked_until">>();
      const state = result.results?.[0];

      return state
        ? {
            failedLoginCount: state.failed_login_count,
            lockedUntil: state.locked_until
          }
        : null;
    },

    async clearFailedPasswordAttempts(userId, now) {
      await db
        .prepare(
          `UPDATE admin_credentials
           SET failed_login_count = 0,
               locked_until = '',
               updated_at = ?
           WHERE user_id = ?`
        )
        .bind(now.toISOString(), userId)
        .run();
    },

    async writeSecurityAuditEntry(entry) {
      await db
        .prepare(
          `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
           VALUES (${ADMIN_AUDIT_LOG_ROW_COLUMNS.map(() => "?").join(", ")})`
        )
        .bind(...ADMIN_AUDIT_LOG_ROW_COLUMNS.map((column) => entry[column]))
        .run();
    }
  };
}
