import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import {
  ADMIN_AUDIT_LOG_ROW_COLUMNS,
  ADMIN_CREDENTIAL_ROW_COLUMNS,
  ADMIN_PASSWORD_RESET_TOKEN_ROW_COLUMNS,
  ADMIN_USER_INVITATION_ROW_COLUMNS,
  type AdminAuditLogRow,
  type AdminCredentialRow,
  type AdminPasswordResetTokenRow,
  type AdminUserInvitationRow,
  type AdminUserRow
} from "./schema";

export const CMS_INVITATION_LIFETIME_SECONDS = 72 * 60 * 60;
export const CMS_PASSWORD_RESET_LIFETIME_SECONDS = 30 * 60;

export type InvitationStatus = "none" | "pending" | "expired";

export interface SafeAdminUserLifecycle {
  id: string;
  email: string;
  name: string;
  role: AdminUserRow["role"];
  status: AdminUserRow["status"];
  username: string | null;
  isRoot: boolean;
  mustChangePassword: boolean;
  mfaRequired: boolean;
  credentialConfigured: boolean;
  invitationStatus: InvitationStatus;
  invitationExpiresAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

interface SafeAdminUserLifecycleRow {
  id: string;
  email: string;
  name: string;
  role: AdminUserRow["role"];
  status: AdminUserRow["status"];
  username: string | null;
  is_root: 0 | 1;
  must_change_password: 0 | 1;
  mfa_required: 0 | 1;
  credential_configured: 0 | 1;
  invitation_status: InvitationStatus;
  invitation_expires_at: string | null;
  last_login_at: string;
  created_at: string;
  updated_at: string;
  revision: number;
}

export interface InvitationInspection {
  invitationId: string;
  userId: string;
  email: string;
  name: string;
  role: AdminUserRow["role"];
  username: string | null;
  expiresAt: string;
}

export interface PasswordResetInspection {
  resetTokenId: string;
  userId: string;
  email: string;
  expiresAt: string;
}

export type AdminUserLifecycleConflictCode =
  | "credential_configured"
  | "credential_missing"
  | "duplicate_email"
  | "duplicate_username"
  | "invalid_invitation"
  | "invalid_password_reset"
  | "ineligible_user"
  | "stale_revision";

export class AdminUserLifecycleConflict extends Error {
  constructor(readonly code: AdminUserLifecycleConflictCode) {
    super(code);
    this.name = "AdminUserLifecycleConflict";
    Object.setPrototypeOf(this, AdminUserLifecycleConflict.prototype);
  }
}

export interface CreateUserWithInvitationInput {
  user: {
    id: string;
    email: string;
    name: string;
    role: AdminUserRow["role"];
    username: string | null;
  };
  invitation: AdminUserInvitationRow;
  actor: string;
  now: string;
}

export interface IssueLifecycleTokenInput {
  userId: string;
  actor: string;
  token: AdminUserInvitationRow | AdminPasswordResetTokenRow;
  now: string;
}

export interface AcceptInvitationInput {
  invitationId: string;
  userId: string;
  tokenHash: string;
  passwordHash: string;
  passwordAlgorithm: string;
  username: string | null;
  expectedUsername: string | null;
  actor: string;
  now: string;
}

export interface CompletePasswordResetInput {
  resetTokenId: string;
  userId: string;
  tokenHash: string;
  passwordHash: string;
  passwordAlgorithm: string;
  actor: string;
  now: string;
}

export interface ChangeUserPasswordInput {
  userId: string;
  expectedPasswordHash: string;
  passwordHash: string;
  passwordAlgorithm: string;
  actor: string;
  now: string;
}

export interface UpdateUserWithSecurityRevocationInput {
  userId: string;
  email: string;
  name: string;
  role: AdminUserRow["role"];
  status: AdminUserRow["status"];
  username: string | null;
  actor: string;
  now: string;
  expectedRevision: number | null;
  securitySensitive: boolean;
  revokeInvitations: boolean;
}

export interface AdminUserLifecycleRepository {
  listSafeUserLifecycleStatuses(now: string): Promise<SafeAdminUserLifecycle[]>;
  readSafeUserLifecycleStatus(userId: string, now: string): Promise<SafeAdminUserLifecycle | null>;
  readSafeUserLifecycleStatusByEmail(email: string, now: string): Promise<SafeAdminUserLifecycle | null>;
  isUsernameAvailable(username: string, userId: string): Promise<boolean>;
  getCredentialByUserId(userId: string): Promise<AdminCredentialRow | null>;
  createUserWithInvitation(input: CreateUserWithInvitationInput): Promise<void>;
  issueInvitationForExistingUser(input: IssueLifecycleTokenInput): Promise<void>;
  revokePendingInvitations(userId: string, actor: string, now: string): Promise<boolean>;
  inspectInvitationByTokenHash(tokenHash: string, now: string): Promise<InvitationInspection | null>;
  acceptInvitation(input: AcceptInvitationInput): Promise<void>;
  issuePasswordReset(input: IssueLifecycleTokenInput): Promise<void>;
  inspectPasswordResetByTokenHash(tokenHash: string, now: string): Promise<PasswordResetInspection | null>;
  completePasswordReset(input: CompletePasswordResetInput): Promise<void>;
  changeUserPassword(input: ChangeUserPasswordInput): Promise<void>;
  revokeUserSessions(userId: string, actor: string, now: string): Promise<void>;
  updateUserWithSecurityRevocation(input: UpdateUserWithSecurityRevocationInput): Promise<void>;
  deleteUserWithAudit(
    user: SafeAdminUserLifecycle,
    actor: string,
    now: string,
    expectedRevision: number | null
  ): Promise<void>;
  writeLifecycleAuditEvent(entry: AdminAuditLogRow): Promise<void>;
}

const SAFE_USER_SELECT = `
  u.id,
  u.email,
  u.name,
  u.role,
  u.status,
  u.username,
  u.is_root,
  u.must_change_password,
  u.mfa_required,
  CASE WHEN EXISTS (SELECT 1 FROM admin_credentials AS c WHERE c.user_id = u.id) THEN 1 ELSE 0 END
    AS credential_configured,
  CASE
    WHEN EXISTS (SELECT 1 FROM admin_credentials AS c WHERE c.user_id = u.id) THEN 'none'
    WHEN EXISTS (
      SELECT 1 FROM admin_user_invitations AS i
      WHERE i.user_id = u.id AND i.accepted_at = '' AND i.revoked_at = '' AND i.expires_at > ?
    ) THEN 'pending'
    WHEN EXISTS (
      SELECT 1 FROM admin_user_invitations AS i
      WHERE i.user_id = u.id AND i.accepted_at = '' AND i.revoked_at = '' AND i.expires_at <= ?
    ) THEN 'expired'
    ELSE 'none'
  END AS invitation_status,
  CASE
    WHEN EXISTS (SELECT 1 FROM admin_credentials AS c WHERE c.user_id = u.id) THEN NULL
    ELSE (
      SELECT i.expires_at FROM admin_user_invitations AS i
      WHERE i.user_id = u.id AND i.accepted_at = '' AND i.revoked_at = ''
      ORDER BY CASE WHEN i.expires_at > ? THEN 0 ELSE 1 END, i.created_at DESC
      LIMIT 1
    )
  END AS invitation_expires_at,
  u.last_login_at,
  u.created_at,
  u.updated_at,
  u.revision`;

function mapSafeUser(row: SafeAdminUserLifecycleRow): SafeAdminUserLifecycle {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    username: row.username ?? null,
    isRoot: row.is_root === 1,
    mustChangePassword: row.must_change_password === 1,
    mfaRequired: row.mfa_required === 1,
    credentialConfigured: row.credential_configured === 1,
    invitationStatus: row.invitation_status ?? "none",
    invitationExpiresAt: row.invitation_expires_at ?? null,
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision
  };
}

function auditEntry(input: {
  id?: string;
  userId: string;
  action: string;
  actor: string;
  now: string;
  entityType?: string;
  metadata?: Record<string, boolean | string>;
}): AdminAuditLogRow {
  return {
    id: input.id ?? `admin-audit-${crypto.randomUUID()}`,
    entity_type: input.entityType ?? "admin-user",
    entity_id: input.userId,
    action: input.action,
    actor: input.actor,
    created_at: input.now,
    metadata_json: JSON.stringify(input.metadata ?? {})
  };
}

function insertAudit(db: D1Database, entry: AdminAuditLogRow) {
  return db
    .prepare(
      `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
       VALUES (${ADMIN_AUDIT_LOG_ROW_COLUMNS.map(() => "?").join(", ")})`
    )
    .bind(...ADMIN_AUDIT_LOG_ROW_COLUMNS.map((column) => entry[column]));
}

function guardedAudit(db: D1Database, entry: AdminAuditLogRow, eligibilitySql: string, eligibilityBindings: unknown[]) {
  return db
    .prepare(
      `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
       VALUES (?, ?, ?, ?, ?, ?, CASE WHEN EXISTS (${eligibilitySql}) THEN ? ELSE NULL END)`
    )
    .bind(
      entry.id,
      entry.entity_type,
      entry.entity_id,
      entry.action,
      entry.actor,
      entry.created_at,
      ...eligibilityBindings,
      entry.metadata_json
    );
}

function changes(result: D1Result<unknown> | undefined) {
  const meta = result?.meta as { changes?: number; rows_written?: number } | undefined;
  return Number(meta?.changes ?? meta?.rows_written ?? 0);
}

function classifyConflict(error: unknown, fallback: AdminUserLifecycleConflictCode): never {
  const message = error instanceof Error ? error.message : String(error);

  if (/idx_app_admin_users_email_nocase|app_admin_users\.email/i.test(message)) {
    throw new AdminUserLifecycleConflict("duplicate_email");
  }

  if (/idx_app_admin_users_username_nocase|app_admin_users\.username/i.test(message)) {
    throw new AdminUserLifecycleConflict("duplicate_username");
  }

  if (/admin_credentials\.user_id|credential_configured/i.test(message)) {
    throw new AdminUserLifecycleConflict("credential_configured");
  }

  if (/NOT NULL constraint failed|UNIQUE constraint failed:\s*admin_audit_log\.id/i.test(message)) {
    throw new AdminUserLifecycleConflict(fallback);
  }

  throw error;
}

export function createAdminUserLifecycleRepository(env: Env): AdminUserLifecycleRepository {
  const db = requireD1Database(env);

  async function readSafeUser(where: string, value: string, now: string) {
    const row = await db
      .prepare(
        `WITH target_user AS (SELECT * FROM app_admin_users AS u WHERE ${where})
         SELECT ${SAFE_USER_SELECT} FROM target_user AS u LIMIT 1`
      )
      .bind(value, now, now, now)
      .first<SafeAdminUserLifecycleRow>();
    return row ? mapSafeUser(row) : null;
  }

  return {
    async listSafeUserLifecycleStatuses(now) {
      const result = await db
        .prepare(`SELECT ${SAFE_USER_SELECT} FROM app_admin_users AS u ORDER BY u.role ASC, u.email ASC`)
        .bind(now, now, now)
        .all<SafeAdminUserLifecycleRow>();
      return (result.results ?? []).map(mapSafeUser);
    },

    readSafeUserLifecycleStatus(userId, now) {
      return readSafeUser("id = ?", userId, now);
    },

    readSafeUserLifecycleStatusByEmail(email, now) {
      return readSafeUser("email = ? COLLATE NOCASE", email, now);
    },

    async isUsernameAvailable(username, userId) {
      const row = await db
        .prepare("SELECT id FROM app_admin_users WHERE username = ? COLLATE NOCASE AND id != ? LIMIT 1")
        .bind(username, userId)
        .first<{ id: string }>();
      return !row;
    },

    getCredentialByUserId(userId) {
      return db
        .prepare(`SELECT ${ADMIN_CREDENTIAL_ROW_COLUMNS.join(", ")} FROM admin_credentials WHERE user_id = ?`)
        .bind(userId)
        .first<AdminCredentialRow>();
    },

    async createUserWithInvitation(input) {
      const { user, invitation } = input;
      const audit = auditEntry({
        userId: user.id,
        action: "user.invited",
        actor: input.actor,
        now: input.now,
        metadata: { role: user.role }
      });

      try {
        await db.batch([
          db
            .prepare(
              `INSERT INTO app_admin_users
               (id, email, name, role, status, created_at, updated_at, created_by, updated_by, revision,
                username, is_root, must_change_password, mfa_required, session_version, last_login_at)
               VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, ?, 0, 1, 0, 1, '')`
            )
            .bind(
              user.id,
              user.email,
              user.name,
              user.role,
              input.now,
              input.now,
              input.actor,
              input.actor,
              user.username
            ),
          db
            .prepare(
              `INSERT INTO admin_user_invitations (${ADMIN_USER_INVITATION_ROW_COLUMNS.join(", ")})
               VALUES (${ADMIN_USER_INVITATION_ROW_COLUMNS.map(() => "?").join(", ")})`
            )
            .bind(...ADMIN_USER_INVITATION_ROW_COLUMNS.map((column) => invitation[column])),
          insertAudit(db, audit)
        ]);
      } catch (error) {
        classifyConflict(error, "ineligible_user");
      }
    },

    async issueInvitationForExistingUser(input) {
      const invitation = input.token as AdminUserInvitationRow;
      const eligible = `SELECT 1 FROM app_admin_users AS u
        WHERE u.id = ? AND u.is_root = 0 AND u.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM admin_credentials AS c WHERE c.user_id = u.id)`;
      const audit = auditEntry({
        userId: input.userId,
        action: "user.invited",
        actor: input.actor,
        now: input.now
      });

      try {
        await db.batch([
          db
            .prepare(
              `UPDATE admin_user_invitations SET revoked_at = ?
               WHERE user_id = ? AND accepted_at = '' AND revoked_at = ''`
            )
            .bind(input.now, input.userId),
          db
            .prepare(
              `INSERT INTO admin_user_invitations (${ADMIN_USER_INVITATION_ROW_COLUMNS.join(", ")})
               VALUES (?, ?, CASE WHEN EXISTS (${eligible}) THEN ? ELSE NULL END, ?, ?, ?, '', '', ?)`
            )
            .bind(
              invitation.id,
              input.userId,
              input.userId,
              invitation.token_hash,
              invitation.created_by,
              invitation.created_at,
              invitation.expires_at,
              invitation.request_ip_hash
            ),
          insertAudit(db, audit)
        ]);
      } catch (error) {
        classifyConflict(error, "ineligible_user");
      }
    },

    async revokePendingInvitations(userId, actor, now) {
      const audit = auditEntry({ userId, action: "user.invitation_revoked", actor, now });
      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
             SELECT ${ADMIN_AUDIT_LOG_ROW_COLUMNS.map(() => "?").join(", ")}
             WHERE EXISTS (
               SELECT 1 FROM admin_user_invitations
               WHERE user_id = ? AND accepted_at = '' AND revoked_at = ''
             )`
          )
          .bind(...ADMIN_AUDIT_LOG_ROW_COLUMNS.map((column) => audit[column]), userId),
        db
          .prepare(
            `UPDATE admin_user_invitations SET revoked_at = ?
             WHERE user_id = ? AND accepted_at = '' AND revoked_at = ''`
          )
          .bind(now, userId)
      ]);
      return changes(results[0]) > 0;
    },

    async inspectInvitationByTokenHash(tokenHash, now) {
      return db
        .prepare(
          `SELECT i.id AS invitationId, u.id AS userId, u.email, u.name, u.role, u.username, i.expires_at AS expiresAt
           FROM admin_user_invitations AS i
           INNER JOIN app_admin_users AS u ON u.id = i.user_id
           WHERE i.token_hash = ? AND i.accepted_at = '' AND i.revoked_at = '' AND i.expires_at > ?
             AND u.status = 'active' AND u.is_root = 0
             AND NOT EXISTS (SELECT 1 FROM admin_credentials AS c WHERE c.user_id = u.id)
           LIMIT 1`
        )
        .bind(tokenHash, now)
        .first<InvitationInspection>();
    },

    async acceptInvitation(input) {
      const eligible = `SELECT 1 FROM admin_user_invitations AS i
        INNER JOIN app_admin_users AS u ON u.id = i.user_id
        WHERE i.id = ? AND i.user_id = ? AND i.token_hash = ?
          AND i.accepted_at = '' AND i.revoked_at = '' AND i.expires_at > ?
          AND u.status = 'active' AND u.is_root = 0
          AND ((u.username IS NULL AND ? IS NULL) OR u.username = ? COLLATE NOCASE)
          AND NOT EXISTS (SELECT 1 FROM admin_credentials AS c WHERE c.user_id = u.id)`;
      const audit = auditEntry({
        id: `admin-audit-invitation-accepted-${input.invitationId}`,
        userId: input.userId,
        action: "user.invitation_accepted",
        actor: input.actor,
        now: input.now
      });

      try {
        await db.batch([
          guardedAudit(db, audit, eligible, [
            input.invitationId,
            input.userId,
            input.tokenHash,
            input.now,
            input.expectedUsername,
            input.expectedUsername
          ]),
          db
            .prepare(
              `INSERT INTO admin_credentials (${ADMIN_CREDENTIAL_ROW_COLUMNS.join(", ")})
               SELECT ?, ?, ?, ?, 0, '', ?, ? WHERE EXISTS (${eligible})`
            )
            .bind(
              input.userId,
              input.passwordHash,
              input.passwordAlgorithm,
              input.now,
              input.now,
              input.now,
              input.invitationId,
              input.userId,
              input.tokenHash,
              input.now,
              input.expectedUsername,
              input.expectedUsername
            ),
          db
            .prepare(
              `UPDATE app_admin_users
               SET username = CASE WHEN username IS NULL THEN ? ELSE username END,
                   must_change_password = 0, session_version = session_version + 1,
                   updated_at = ?, updated_by = ?, revision = revision + 1
               WHERE id = ?`
            )
            .bind(input.username, input.now, input.actor, input.userId),
          db
            .prepare(
              "UPDATE admin_user_invitations SET accepted_at = ? WHERE id = ? AND accepted_at = '' AND revoked_at = ''"
            )
            .bind(input.now, input.invitationId),
          db
            .prepare(
              `UPDATE admin_user_invitations SET revoked_at = ?
               WHERE user_id = ? AND id != ? AND accepted_at = '' AND revoked_at = ''`
            )
            .bind(input.now, input.userId, input.invitationId),
          db
            .prepare(
              `UPDATE admin_password_reset_tokens SET revoked_at = ?
               WHERE user_id = ? AND used_at = '' AND revoked_at = ''`
            )
            .bind(input.now, input.userId),
          db
            .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''")
            .bind(input.now, input.userId)
        ]);
      } catch (error) {
        classifyConflict(error, "invalid_invitation");
      }
    },

    async issuePasswordReset(input) {
      const token = input.token as AdminPasswordResetTokenRow;
      const eligible = `SELECT 1 FROM app_admin_users AS u
        WHERE u.id = ? AND u.is_root = 0 AND u.status = 'active'
          AND EXISTS (SELECT 1 FROM admin_credentials AS c WHERE c.user_id = u.id)`;
      const audit = auditEntry({
        userId: input.userId,
        action: "credential.reset_issued",
        actor: input.actor,
        now: input.now
      });

      try {
        await db.batch([
          db
            .prepare(
              `UPDATE admin_password_reset_tokens SET revoked_at = ?
               WHERE user_id = ? AND used_at = '' AND revoked_at = ''`
            )
            .bind(input.now, input.userId),
          db
            .prepare(
              `INSERT INTO admin_password_reset_tokens (${ADMIN_PASSWORD_RESET_TOKEN_ROW_COLUMNS.join(", ")})
               VALUES (?, ?, CASE WHEN EXISTS (${eligible}) THEN ? ELSE NULL END, ?, ?, '', '', ?)`
            )
            .bind(
              token.id,
              input.userId,
              input.userId,
              token.token_hash,
              token.created_at,
              token.expires_at,
              token.request_ip_hash
            ),
          insertAudit(db, audit)
        ]);
      } catch (error) {
        classifyConflict(error, "ineligible_user");
      }
    },

    async inspectPasswordResetByTokenHash(tokenHash, now) {
      return db
        .prepare(
          `SELECT r.id AS resetTokenId, u.id AS userId, u.email, r.expires_at AS expiresAt
           FROM admin_password_reset_tokens AS r
           INNER JOIN app_admin_users AS u ON u.id = r.user_id
           WHERE r.token_hash = ? AND r.used_at = '' AND r.revoked_at = '' AND r.expires_at > ?
             AND u.status = 'active' AND u.is_root = 0
             AND EXISTS (SELECT 1 FROM admin_credentials AS c WHERE c.user_id = u.id)
           LIMIT 1`
        )
        .bind(tokenHash, now)
        .first<PasswordResetInspection>();
    },

    async completePasswordReset(input) {
      const eligible = `SELECT 1 FROM admin_password_reset_tokens AS r
        INNER JOIN app_admin_users AS u ON u.id = r.user_id
        WHERE r.id = ? AND r.user_id = ? AND r.token_hash = ?
          AND r.used_at = '' AND r.revoked_at = '' AND r.expires_at > ?
          AND u.status = 'active' AND u.is_root = 0
          AND EXISTS (SELECT 1 FROM admin_credentials AS c WHERE c.user_id = u.id)`;
      const audit = auditEntry({
        id: `admin-audit-password-reset-${input.resetTokenId}`,
        userId: input.userId,
        action: "credential.password_reset",
        actor: input.actor,
        now: input.now
      });

      try {
        await db.batch([
          guardedAudit(db, audit, eligible, [input.resetTokenId, input.userId, input.tokenHash, input.now]),
          db
            .prepare(
              `UPDATE admin_credentials
               SET password_hash = ?, password_algorithm = ?, password_changed_at = ?,
                   failed_login_count = 0, locked_until = '', updated_at = ?
               WHERE user_id = ?`
            )
            .bind(input.passwordHash, input.passwordAlgorithm, input.now, input.now, input.userId),
          db
            .prepare(
              "UPDATE admin_password_reset_tokens SET used_at = ? WHERE id = ? AND used_at = '' AND revoked_at = ''"
            )
            .bind(input.now, input.resetTokenId),
          db
            .prepare(
              `UPDATE admin_password_reset_tokens SET revoked_at = ?
               WHERE user_id = ? AND id != ? AND used_at = '' AND revoked_at = ''`
            )
            .bind(input.now, input.userId, input.resetTokenId),
          db
            .prepare(
              `UPDATE admin_user_invitations SET revoked_at = ?
               WHERE user_id = ? AND accepted_at = '' AND revoked_at = ''`
            )
            .bind(input.now, input.userId),
          db
            .prepare(
              `UPDATE app_admin_users SET session_version = session_version + 1,
               updated_at = ?, updated_by = ?, revision = revision + 1 WHERE id = ?`
            )
            .bind(input.now, input.actor, input.userId),
          db
            .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''")
            .bind(input.now, input.userId)
        ]);
      } catch (error) {
        classifyConflict(error, "invalid_password_reset");
      }
    },

    async changeUserPassword(input) {
      const eligible = `SELECT 1 FROM app_admin_users AS u
        INNER JOIN admin_credentials AS c ON c.user_id = u.id
        WHERE u.id = ? AND u.status = 'active' AND c.password_hash = ?`;
      const audit = auditEntry({
        userId: input.userId,
        action: "credential.password_changed",
        actor: input.actor,
        now: input.now
      });

      try {
        await db.batch([
          guardedAudit(db, audit, eligible, [input.userId, input.expectedPasswordHash]),
          db
            .prepare(
              `UPDATE admin_credentials
               SET password_hash = ?, password_algorithm = ?, password_changed_at = ?,
                   failed_login_count = 0, locked_until = '', updated_at = ?
               WHERE user_id = ? AND password_hash = ?`
            )
            .bind(
              input.passwordHash,
              input.passwordAlgorithm,
              input.now,
              input.now,
              input.userId,
              input.expectedPasswordHash
            ),
          db
            .prepare(
              `UPDATE app_admin_users SET session_version = session_version + 1,
               updated_at = ?, updated_by = ?, revision = revision + 1 WHERE id = ?`
            )
            .bind(input.now, input.actor, input.userId),
          db
            .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''")
            .bind(input.now, input.userId),
          db
            .prepare(
              `UPDATE admin_password_reset_tokens SET revoked_at = ?
               WHERE user_id = ? AND used_at = '' AND revoked_at = ''`
            )
            .bind(input.now, input.userId)
        ]);
      } catch (error) {
        classifyConflict(error, "credential_missing");
      }
    },

    async revokeUserSessions(userId, actor, now) {
      const audit = auditEntry({
        userId,
        action: "session.user_revoked",
        actor,
        now,
        entityType: "admin-session"
      });
      const eligible = "SELECT 1 FROM app_admin_users WHERE id = ?";

      try {
        await db.batch([
          guardedAudit(db, audit, eligible, [userId]),
          db
            .prepare("UPDATE app_admin_users SET session_version = session_version + 1, updated_at = ? WHERE id = ?")
            .bind(now, userId),
          db.prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''").bind(now, userId)
        ]);
      } catch (error) {
        classifyConflict(error, "ineligible_user");
      }
    },

    async updateUserWithSecurityRevocation(input) {
      const revisionGuard = input.expectedRevision === null ? "" : " AND revision = ?";
      const revisionBindings = input.expectedRevision === null ? [] : [input.expectedRevision];

      if (!input.securitySensitive) {
        const result = await db
          .prepare(
            `UPDATE app_admin_users
             SET email = ?, name = ?, role = ?, status = ?, updated_at = ?, updated_by = ?, revision = revision + 1
             WHERE id = ?${revisionGuard}`
          )
          .bind(
            input.email,
            input.name,
            input.role,
            input.status,
            input.now,
            input.actor,
            input.userId,
            ...revisionBindings
          )
          .run();

        if (changes(result) === 0) {
          throw new AdminUserLifecycleConflict("stale_revision");
        }
        return;
      }

      const eligible = `SELECT 1 FROM app_admin_users WHERE id = ?${revisionGuard}`;
      const audit = auditEntry({
        userId: input.userId,
        action: "user.security_updated",
        actor: input.actor,
        now: input.now,
        metadata: { status: input.status, role: input.role }
      });

      try {
        await db.batch([
          guardedAudit(db, audit, eligible, [input.userId, ...revisionBindings]),
          db
            .prepare(
              `UPDATE app_admin_users
               SET email = ?, name = ?, role = ?, status = ?, username = ?,
                   session_version = session_version + 1, updated_at = ?, updated_by = ?, revision = revision + 1
               WHERE id = ?${revisionGuard}`
            )
            .bind(
              input.email,
              input.name,
              input.role,
              input.status,
              input.username,
              input.now,
              input.actor,
              input.userId,
              ...revisionBindings
            ),
          db
            .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''")
            .bind(input.now, input.userId),
          db
            .prepare(
              `UPDATE admin_password_reset_tokens SET revoked_at = ?
               WHERE user_id = ? AND used_at = '' AND revoked_at = ''`
            )
            .bind(input.now, input.userId),
          db
            .prepare(
              `UPDATE admin_user_invitations SET revoked_at = ?
               WHERE user_id = ? AND accepted_at = '' AND revoked_at = '' AND ? = 1`
            )
            .bind(input.now, input.userId, input.revokeInvitations ? 1 : 0)
        ]);
      } catch (error) {
        classifyConflict(error, "stale_revision");
      }
    },

    async deleteUserWithAudit(user, actor, now, expectedRevision) {
      const revisionGuard = expectedRevision === null ? "" : " AND revision = ?";
      const revisionBindings = expectedRevision === null ? [] : [expectedRevision];
      const audit = auditEntry({
        userId: user.id,
        action: "user.deleted",
        actor,
        now,
        metadata: { targetRole: user.role, root: false }
      });
      const eligible = `SELECT 1 FROM app_admin_users WHERE id = ? AND is_root = 0${revisionGuard}`;

      try {
        await db.batch([
          guardedAudit(db, audit, eligible, [user.id, ...revisionBindings]),
          db
            .prepare(`DELETE FROM app_admin_users WHERE id = ? AND is_root = 0${revisionGuard}`)
            .bind(user.id, ...revisionBindings)
        ]);
      } catch (error) {
        classifyConflict(error, "stale_revision");
      }
    },

    async writeLifecycleAuditEvent(entry) {
      await insertAudit(db, entry).run();
    }
  };
}
