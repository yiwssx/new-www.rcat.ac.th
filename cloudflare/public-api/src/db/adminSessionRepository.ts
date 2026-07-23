import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import {
  ADMIN_AUDIT_LOG_ROW_COLUMNS,
  ADMIN_AUTH_USER_ROW_COLUMNS,
  ADMIN_SESSION_ROW_COLUMNS,
  type AdminAuditLogRow,
  type AdminAuthUserRow,
  type AdminSessionRow
} from "./schema";

export interface AdminSessionWithUser {
  session: AdminSessionRow;
  user: AdminAuthUserRow;
  effectiveMfa: boolean;
}

export interface CreateAdminSessionInput {
  session: AdminSessionRow;
  actor: string;
  isRoot: boolean;
}

export interface TouchAdminSessionInput {
  sessionId: string;
  previousLastSeenAtOrBefore: string;
  lastSeenAt: string;
  idleExpiresAt: string;
}

export interface RevokeAdminSessionInput {
  sessionId: string;
  userId: string;
  actor: string;
  now: string;
}

export interface RevokeAllAdminSessionsInput {
  userId: string;
  actor: string;
  now: string;
}

export interface AdminSessionRepository {
  createSession(input: CreateAdminSessionInput): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<AdminSessionWithUser | null>;
  touchSession(input: TouchAdminSessionInput): Promise<boolean>;
  revokeSession(input: RevokeAdminSessionInput): Promise<void>;
  revokeAllUserSessions(input: RevokeAllAdminSessionsInput): Promise<void>;
  updateLastLoginAt(userId: string, now: string): Promise<void>;
  writeSessionSecurityAuditEntry(entry: AdminAuditLogRow): Promise<void>;
}

type JoinedSessionRow = Record<string, string | number | null>;

const SESSION_SELECT_COLUMNS = ADMIN_SESSION_ROW_COLUMNS.map((column) => `s.${column} AS session_${column}`);
const USER_SELECT_COLUMNS = ADMIN_AUTH_USER_ROW_COLUMNS.map((column) => `u.${column} AS user_${column}`);

function getChangedRows(result: D1Result<unknown>) {
  const meta = result.meta as { changes?: number; rows_written?: number } | undefined;
  return Number(meta?.changes ?? meta?.rows_written ?? 0);
}

function mapJoinedSession(row: JoinedSessionRow | null): AdminSessionWithUser | null {
  if (!row) {
    return null;
  }

  const session = Object.fromEntries(
    ADMIN_SESSION_ROW_COLUMNS.map((column) => [column, row[`session_${column}`]])
  ) as unknown as AdminSessionRow;
  const user = Object.fromEntries(
    ADMIN_AUTH_USER_ROW_COLUMNS.map((column) => [column, row[`user_${column}`]])
  ) as unknown as AdminAuthUserRow;

  return { session, user, effectiveMfa: Number(row.effective_mfa ?? 0) === 1 };
}

function makeAuditEntry(input: {
  action: string;
  actor: string;
  metadata?: Record<string, boolean | string>;
  now: string;
  userId: string;
}): AdminAuditLogRow {
  return {
    id: `admin-audit-${crypto.randomUUID()}`,
    entity_type: "admin-session",
    entity_id: input.userId,
    action: input.action,
    actor: input.actor,
    created_at: input.now,
    metadata_json: JSON.stringify(input.metadata ?? {})
  };
}

function bindAudit(statement: D1PreparedStatement, entry: AdminAuditLogRow) {
  return statement.bind(...ADMIN_AUDIT_LOG_ROW_COLUMNS.map((column) => entry[column]));
}

export function createAdminSessionRepository(env: Env): AdminSessionRepository {
  const db = requireD1Database(env);

  return {
    async createSession(input) {
      const { session } = input;
      const audit = makeAuditEntry({
        action: "session.login",
        actor: input.actor,
        metadata: { authentication: session.mfa_verified_at ? "mfa" : "password", root: input.isRoot },
        now: session.created_at,
        userId: session.user_id
      });
      const sessionValues = ADMIN_SESSION_ROW_COLUMNS.map((column) => session[column]);
      const tokenHashIndex = ADMIN_SESSION_ROW_COLUMNS.indexOf("token_hash");
      const guardedSessionValues = sessionValues.map((_, index) => (index === tokenHashIndex ? "GUARDED" : "?"));
      const insertBindings = [...sessionValues];
      insertBindings.splice(tokenHashIndex, 1);

      await db.batch([
        db
          .prepare(
            `INSERT INTO admin_sessions (${ADMIN_SESSION_ROW_COLUMNS.join(", ")})
             SELECT ${guardedSessionValues
               .map((value) =>
                 value === "GUARDED"
                   ? `CASE WHEN EXISTS (
                        SELECT 1 FROM app_admin_users
                        WHERE id = ?
                          AND status = 'active'
                          AND role IN ('admin', 'editor', 'viewer')
                          AND must_change_password = 0
                          AND (
                            (is_root = 0 AND mfa_required = 0 AND NOT EXISTS (
                              SELECT 1 FROM admin_mfa_totp
                              WHERE user_id = app_admin_users.id AND state = 'enabled'
                            ))
                            OR ? != ''
                          )
                          AND session_version = ?
                      ) THEN ? ELSE NULL END`
                   : value
               )
               .join(", ")}`
          )
          .bind(
            ...insertBindings.slice(0, tokenHashIndex),
            session.user_id,
            session.mfa_verified_at,
            session.session_version,
            session.token_hash,
            ...insertBindings.slice(tokenHashIndex)
          ),
        db
          .prepare(
            `UPDATE app_admin_users
             SET last_login_at = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(session.created_at, session.created_at, session.user_id),
        bindAudit(
          db.prepare(
            `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
             VALUES (${ADMIN_AUDIT_LOG_ROW_COLUMNS.map(() => "?").join(", ")})`
          ),
          audit
        )
      ]);
    },

    async findSessionByTokenHash(tokenHash) {
      const row = await db
        .prepare(
          `SELECT ${[...SESSION_SELECT_COLUMNS, ...USER_SELECT_COLUMNS].join(", ")},
                  CASE WHEN u.is_root = 1 OR u.mfa_required = 1 OR EXISTS (
                    SELECT 1 FROM admin_mfa_totp f
                    WHERE f.user_id = u.id AND f.state = 'enabled'
                  ) THEN 1 ELSE 0 END AS effective_mfa
           FROM admin_sessions AS s
           INNER JOIN app_admin_users AS u ON u.id = s.user_id
           WHERE s.token_hash = ?`
        )
        .bind(tokenHash)
        .first<JoinedSessionRow>();

      return mapJoinedSession(row);
    },

    async touchSession(input) {
      const result = await db
        .prepare(
          `UPDATE admin_sessions
           SET last_seen_at = ?, idle_expires_at = ?
           WHERE id = ?
             AND revoked_at = ''
             AND last_seen_at <= ?
             AND idle_expires_at > ?
             AND absolute_expires_at > ?`
        )
        .bind(
          input.lastSeenAt,
          input.idleExpiresAt,
          input.sessionId,
          input.previousLastSeenAtOrBefore,
          input.lastSeenAt,
          input.lastSeenAt
        )
        .run();

      return getChangedRows(result) > 0;
    },

    async revokeSession(input) {
      const audit = makeAuditEntry({
        action: "session.logout",
        actor: input.actor,
        now: input.now,
        userId: input.userId
      });

      await db.batch([
        db
          .prepare(
            `UPDATE admin_sessions
             SET revoked_at = ?
             WHERE id = ? AND user_id = ? AND revoked_at = ''`
          )
          .bind(input.now, input.sessionId, input.userId),
        db
          .prepare(
            `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
             SELECT ${ADMIN_AUDIT_LOG_ROW_COLUMNS.map(() => "?").join(", ")}
             WHERE EXISTS (
               SELECT 1 FROM admin_sessions
               WHERE id = ? AND user_id = ? AND revoked_at = ?
             )`
          )
          .bind(...ADMIN_AUDIT_LOG_ROW_COLUMNS.map((column) => audit[column]), input.sessionId, input.userId, input.now)
      ]);
    },

    async revokeAllUserSessions(input) {
      const audit = makeAuditEntry({
        action: "session.logout_all",
        actor: input.actor,
        now: input.now,
        userId: input.userId
      });

      await db.batch([
        db
          .prepare(
            `UPDATE app_admin_users
             SET session_version = session_version + 1, updated_at = ?
             WHERE id = ?`
          )
          .bind(input.now, input.userId),
        db
          .prepare(
            `UPDATE admin_sessions
             SET revoked_at = ?
             WHERE user_id = ? AND revoked_at = ''`
          )
          .bind(input.now, input.userId),
        db
          .prepare(
            `UPDATE admin_mfa_challenges
             SET revoked_at = ?
             WHERE user_id = ? AND consumed_at = '' AND revoked_at = ''`
          )
          .bind(input.now, input.userId),
        bindAudit(
          db.prepare(
            `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
             VALUES (${ADMIN_AUDIT_LOG_ROW_COLUMNS.map(() => "?").join(", ")})`
          ),
          audit
        )
      ]);
    },

    async updateLastLoginAt(userId, now) {
      await db
        .prepare("UPDATE app_admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?")
        .bind(now, now, userId)
        .run();
    },

    async writeSessionSecurityAuditEntry(entry) {
      await bindAudit(
        db.prepare(
          `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
           VALUES (${ADMIN_AUDIT_LOG_ROW_COLUMNS.map(() => "?").join(", ")})`
        ),
        entry
      ).run();
    }
  };
}
