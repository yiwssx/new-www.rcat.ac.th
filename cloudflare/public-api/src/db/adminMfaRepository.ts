import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import {
  ADMIN_AUDIT_LOG_ROW_COLUMNS,
  ADMIN_AUTH_USER_ROW_COLUMNS,
  ADMIN_MFA_CHALLENGE_ROW_COLUMNS,
  ADMIN_MFA_RECOVERY_CODE_ROW_COLUMNS,
  ADMIN_MFA_TOTP_ROW_COLUMNS,
  ADMIN_SESSION_ROW_COLUMNS,
  type AdminAuditLogRow,
  type AdminAuthUserRow,
  type AdminMfaChallengeRow,
  type AdminMfaRecoveryCodeRow,
  type AdminMfaTotpRow,
  type AdminSessionRow
} from "./schema";

export interface AdminMfaUserState {
  user: AdminAuthUserRow;
  factor: AdminMfaTotpRow | null;
  recoveryCodesRemaining: number;
}

export interface AdminMfaChallengeWithUser {
  challenge: AdminMfaChallengeRow;
  user: AdminAuthUserRow;
  factor: AdminMfaTotpRow | null;
}

export type MfaFactorProof =
  { type: "totp"; matchedStep: number } | { type: "recovery"; codeHash: string; recoveryCodeId: string };

export class AdminMfaConflict extends Error {
  constructor(readonly code: "factor_missing" | "stale_revision") {
    super(code);
    this.name = "AdminMfaConflict";
    Object.setPrototypeOf(this, AdminMfaConflict.prototype);
  }
}

export interface AdminMfaRepository {
  getUserState(userId: string): Promise<AdminMfaUserState | null>;
  findChallengeByTokenHash(tokenHash: string): Promise<AdminMfaChallengeWithUser | null>;
  findUnusedRecoveryCode(userId: string, codeHash: string): Promise<AdminMfaRecoveryCodeRow | null>;
  createChallenge(challenge: AdminMfaChallengeRow, actor: string): Promise<void>;
  recordChallengeFailure(challengeId: string, now: string): Promise<void>;
  replacePendingFactor(factor: AdminMfaTotpRow, actor: string, now: string): Promise<void>;
  completeLoginChallenge(input: {
    challenge: AdminMfaChallengeRow;
    proof: MfaFactorProof;
    session: AdminSessionRow;
    actor: string;
    now: string;
  }): Promise<void>;
  confirmEnrollment(input: {
    challengeId?: string;
    factor: AdminMfaTotpRow;
    expectedSessionVersion: number;
    matchedStep: number;
    recoveryCodes: AdminMfaRecoveryCodeRow[];
    session?: AdminSessionRow;
    actor: string;
    now: string;
  }): Promise<void>;
  regenerateRecoveryCodes(input: {
    userId: string;
    recoveryCodes: AdminMfaRecoveryCodeRow[];
    actor: string;
    now: string;
  }): Promise<void>;
  reauthenticateSession(input: {
    sessionId: string;
    userId: string;
    proof?: MfaFactorProof;
    actor: string;
    now: string;
  }): Promise<void>;
  disableOwnMfa(input: { userId: string; actor: string; now: string }): Promise<void>;
  setMfaRequirement(input: {
    userId: string;
    required: boolean;
    expectedRevision: number;
    actor: string;
    now: string;
  }): Promise<void>;
  resetMfaFactor(input: { userId: string; actor: string; now: string }): Promise<void>;
}

type JoinedRow = Record<string, string | number | null>;

const USER_SELECT = ADMIN_AUTH_USER_ROW_COLUMNS.map((column) => `u.${column} AS user_${column}`);
const FACTOR_SELECT = ADMIN_MFA_TOTP_ROW_COLUMNS.map((column) => `f.${column} AS factor_${column}`);
const CHALLENGE_SELECT = ADMIN_MFA_CHALLENGE_ROW_COLUMNS.map((column) => `c.${column} AS challenge_${column}`);

function mapColumns<T>(row: JoinedRow, prefix: string, columns: readonly string[]) {
  return Object.fromEntries(columns.map((column) => [column, row[`${prefix}_${column}`]])) as T;
}

function mapFactor(row: JoinedRow) {
  return row.factor_user_id === null ? null : mapColumns<AdminMfaTotpRow>(row, "factor", ADMIN_MFA_TOTP_ROW_COLUMNS);
}

function audit(input: {
  action: string;
  actor: string;
  entityId: string;
  now: string;
  metadata?: Record<string, boolean | number | string>;
}): AdminAuditLogRow {
  return {
    id: `admin-audit-${crypto.randomUUID()}`,
    entity_type: "admin-user",
    entity_id: input.entityId,
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

function insertRecoveryCodes(db: D1Database, codes: AdminMfaRecoveryCodeRow[]) {
  return codes.map((code) =>
    db
      .prepare(
        `INSERT INTO admin_mfa_recovery_codes (${ADMIN_MFA_RECOVERY_CODE_ROW_COLUMNS.join(", ")})
         VALUES (${ADMIN_MFA_RECOVERY_CODE_ROW_COLUMNS.map(() => "?").join(", ")})`
      )
      .bind(...ADMIN_MFA_RECOVERY_CODE_ROW_COLUMNS.map((column) => code[column]))
  );
}

function factorProofStatements(db: D1Database, userId: string, proof: MfaFactorProof, now: string) {
  if (proof.type === "totp") {
    return [
      db
        .prepare(
          `UPDATE admin_mfa_totp
           SET last_used_step = ?, updated_at = ?
           WHERE user_id = ? AND state = 'enabled' AND last_used_step < ?`
        )
        .bind(proof.matchedStep, now, userId, proof.matchedStep)
    ];
  }

  return [
    db
      .prepare(
        `UPDATE admin_mfa_recovery_codes
         SET used_at = ?
         WHERE id = ? AND user_id = ? AND code_hash = ? AND used_at = ''`
      )
      .bind(now, proof.recoveryCodeId, userId, proof.codeHash)
  ];
}

function proofGuard(proof: MfaFactorProof) {
  return proof.type === "totp"
    ? `EXISTS (
         SELECT 1 FROM admin_mfa_totp
         WHERE user_id = ? AND state = 'enabled' AND last_used_step = ?
       )`
    : `EXISTS (
         SELECT 1 FROM admin_mfa_recovery_codes
         WHERE id = ? AND user_id = ? AND code_hash = ? AND used_at = ?
       )`;
}

function proofGuardBindings(userId: string, proof: MfaFactorProof, now: string) {
  return proof.type === "totp" ? [userId, proof.matchedStep] : [proof.recoveryCodeId, userId, proof.codeHash, now];
}

function guardedSessionInsert(db: D1Database, session: AdminSessionRow, guardSql: string, guardBindings: unknown[]) {
  const values = ADMIN_SESSION_ROW_COLUMNS.map((column) => session[column]);
  const tokenIndex = ADMIN_SESSION_ROW_COLUMNS.indexOf("token_hash");
  const bindings = [...values];
  bindings.splice(tokenIndex, 1);
  const placeholders = values.map((_, index) =>
    index === tokenIndex ? `CASE WHEN ${guardSql} THEN ? ELSE NULL END` : "?"
  );

  return db
    .prepare(
      `INSERT INTO admin_sessions (${ADMIN_SESSION_ROW_COLUMNS.join(", ")})
       VALUES (${placeholders.join(", ")})`
    )
    .bind(...bindings.slice(0, tokenIndex), ...guardBindings, session.token_hash, ...bindings.slice(tokenIndex));
}

export function isEffectiveMfa(
  user: Pick<AdminAuthUserRow, "is_root" | "mfa_required">,
  factor: AdminMfaTotpRow | null
) {
  return user.is_root === 1 || user.mfa_required === 1 || factor?.state === "enabled";
}

export function createAdminMfaRepository(env: Env): AdminMfaRepository {
  const db = requireD1Database(env);

  return {
    async getUserState(userId) {
      const row = await db
        .prepare(
          `SELECT ${[...USER_SELECT, ...FACTOR_SELECT].join(", ")},
                  (SELECT COUNT(*) FROM admin_mfa_recovery_codes r
                   WHERE r.user_id = u.id AND r.used_at = '') AS recovery_codes_remaining
           FROM app_admin_users u
           LEFT JOIN admin_mfa_totp f ON f.user_id = u.id
           WHERE u.id = ?`
        )
        .bind(userId)
        .first<JoinedRow>();

      return row
        ? {
            user: mapColumns<AdminAuthUserRow>(row, "user", ADMIN_AUTH_USER_ROW_COLUMNS),
            factor: mapFactor(row),
            recoveryCodesRemaining: Number(row.recovery_codes_remaining ?? 0)
          }
        : null;
    },

    async findChallengeByTokenHash(tokenHash) {
      const row = await db
        .prepare(
          `SELECT ${[...CHALLENGE_SELECT, ...USER_SELECT, ...FACTOR_SELECT].join(", ")}
           FROM admin_mfa_challenges c
           INNER JOIN app_admin_users u ON u.id = c.user_id
           LEFT JOIN admin_mfa_totp f ON f.user_id = u.id
           WHERE c.token_hash = ?`
        )
        .bind(tokenHash)
        .first<JoinedRow>();

      return row
        ? {
            challenge: mapColumns<AdminMfaChallengeRow>(row, "challenge", ADMIN_MFA_CHALLENGE_ROW_COLUMNS),
            user: mapColumns<AdminAuthUserRow>(row, "user", ADMIN_AUTH_USER_ROW_COLUMNS),
            factor: mapFactor(row)
          }
        : null;
    },

    async findUnusedRecoveryCode(userId, codeHash) {
      return db
        .prepare(
          `SELECT ${ADMIN_MFA_RECOVERY_CODE_ROW_COLUMNS.join(", ")}
           FROM admin_mfa_recovery_codes
           WHERE user_id = ? AND code_hash = ? AND used_at = ''`
        )
        .bind(userId, codeHash)
        .first<AdminMfaRecoveryCodeRow>();
    },

    async createChallenge(challenge, actor) {
      const entry = audit({
        action: "mfa.challenge_created",
        actor,
        entityId: challenge.user_id,
        now: challenge.created_at,
        metadata: { purpose: challenge.purpose }
      });
      await db.batch([
        db
          .prepare(
            `UPDATE admin_mfa_challenges
             SET revoked_at = ?
             WHERE user_id = ? AND consumed_at = '' AND revoked_at = ''`
          )
          .bind(challenge.created_at, challenge.user_id),
        db
          .prepare(
            `INSERT INTO admin_mfa_challenges (${ADMIN_MFA_CHALLENGE_ROW_COLUMNS.join(", ")})
             VALUES (?, ?, CASE WHEN EXISTS (
               SELECT 1 FROM app_admin_users
               WHERE id = ? AND status = 'active' AND session_version = ?
             ) THEN ? ELSE NULL END, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            challenge.id,
            challenge.user_id,
            challenge.user_id,
            challenge.user_session_version,
            challenge.token_hash,
            challenge.purpose,
            challenge.created_at,
            challenge.expires_at,
            challenge.consumed_at,
            challenge.revoked_at,
            challenge.failed_attempt_count,
            challenge.user_session_version,
            challenge.ip_hash,
            challenge.user_agent_hash
          ),
        insertAudit(db, entry)
      ]);
    },

    async recordChallengeFailure(challengeId, now) {
      await db
        .prepare(
          `UPDATE admin_mfa_challenges
           SET failed_attempt_count = MIN(5, failed_attempt_count + 1),
               revoked_at = CASE WHEN failed_attempt_count + 1 >= 5 THEN ? ELSE revoked_at END
           WHERE id = ? AND consumed_at = '' AND revoked_at = '' AND expires_at > ?`
        )
        .bind(now, challengeId, now)
        .run();
    },

    async replacePendingFactor(factor, actor, now) {
      const entry = audit({
        action: "mfa.enrollment_started",
        actor,
        entityId: factor.user_id,
        now
      });
      await db.batch([
        db.prepare("DELETE FROM admin_mfa_totp WHERE user_id = ? AND state = 'pending'").bind(factor.user_id),
        db
          .prepare(
            `INSERT INTO admin_mfa_totp (${ADMIN_MFA_TOTP_ROW_COLUMNS.join(", ")})
             VALUES (?, CASE WHEN EXISTS (
               SELECT 1 FROM app_admin_users WHERE id = ? AND status = 'active'
             ) AND NOT EXISTS (
               SELECT 1 FROM admin_mfa_totp WHERE user_id = ? AND state = 'enabled'
             ) THEN ? ELSE NULL END, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            factor.user_id,
            factor.user_id,
            factor.user_id,
            factor.encrypted_secret,
            factor.iv,
            factor.key_version,
            factor.state,
            factor.created_at,
            factor.enabled_at,
            factor.updated_at,
            factor.last_used_step
          ),
        insertAudit(db, entry)
      ]);
    },

    async completeLoginChallenge(input) {
      const { challenge, proof, session, now } = input;
      const entry = audit({
        action: "mfa.login_verified",
        actor: input.actor,
        entityId: challenge.user_id,
        now,
        metadata: { method: proof.type === "recovery" ? "recovery-code" : "totp" }
      });
      const recoveryEntry =
        proof.type === "recovery"
          ? audit({
              action: "mfa.recovery_code_used",
              actor: input.actor,
              entityId: challenge.user_id,
              now,
              metadata: { context: "login" }
            })
          : null;
      const challengeGuard = `EXISTS (
        SELECT 1 FROM admin_mfa_challenges
        WHERE id = ? AND user_id = ? AND consumed_at = ?
      )`;
      await db.batch([
        ...factorProofStatements(db, challenge.user_id, proof, now),
        db
          .prepare(
            `UPDATE admin_mfa_challenges
             SET consumed_at = ?
             WHERE id = ? AND user_id = ? AND purpose = 'login'
               AND consumed_at = '' AND revoked_at = '' AND expires_at > ?
               AND failed_attempt_count < 5 AND user_session_version = ?
               AND changes() = 1`
          )
          .bind(now, challenge.id, challenge.user_id, now, session.session_version),
        guardedSessionInsert(
          db,
          session,
          `changes() = 1 AND ${challengeGuard} AND ${proofGuard(proof)} AND EXISTS (
             SELECT 1 FROM app_admin_users
             WHERE id = ? AND status = 'active' AND session_version = ?
           )`,
          [
            challenge.id,
            challenge.user_id,
            now,
            ...proofGuardBindings(challenge.user_id, proof, now),
            challenge.user_id,
            session.session_version
          ]
        ),
        db
          .prepare("UPDATE app_admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?")
          .bind(now, now, challenge.user_id),
        insertAudit(db, entry),
        ...(recoveryEntry ? [insertAudit(db, recoveryEntry)] : [])
      ]);
    },

    async confirmEnrollment(input) {
      const { factor, now } = input;
      if (input.recoveryCodes.length !== 10) {
        throw new TypeError("exactly ten recovery codes are required");
      }
      const entry = audit({ action: "mfa.enabled", actor: input.actor, entityId: factor.user_id, now });
      const activeChallengeGuard = input.challengeId
        ? `AND EXISTS (
             SELECT 1 FROM admin_mfa_challenges
             WHERE id = ? AND user_id = ? AND purpose = 'enrollment'
               AND consumed_at = '' AND revoked_at = '' AND expires_at > ?
               AND failed_attempt_count < 5 AND user_session_version = ?
           )`
        : "";
      const activeChallengeBindings = input.challengeId
        ? [input.challengeId, factor.user_id, now, input.expectedSessionVersion]
        : [];
      const consumedChallengeGuard = input.challengeId
        ? `AND EXISTS (
             SELECT 1 FROM admin_mfa_challenges
             WHERE id = ? AND user_id = ? AND consumed_at = ?
           )`
        : "";
      const consumedChallengeBindings = input.challengeId ? [input.challengeId, factor.user_id, now] : [];
      const statements: D1PreparedStatement[] = [];
      statements.push(
        db
          .prepare(
            `UPDATE admin_mfa_totp
             SET state = 'enabled', enabled_at = ?, updated_at = ?, last_used_step = ?
             WHERE user_id = ? AND state = 'pending'
               AND encrypted_secret = ? AND iv = ? AND key_version = ?
               AND updated_at > ?
               AND EXISTS (
                 SELECT 1 FROM app_admin_users
                 WHERE id = ? AND status = 'active' AND session_version = ?
               ) ${activeChallengeGuard}`
          )
          .bind(
            now,
            now,
            input.matchedStep,
            factor.user_id,
            factor.encrypted_secret,
            factor.iv,
            factor.key_version,
            new Date(Date.parse(now) - 10 * 60 * 1000).toISOString(),
            factor.user_id,
            input.expectedSessionVersion,
            ...activeChallengeBindings
          )
      );
      if (input.challengeId) {
        statements.push(
          db
            .prepare(
              `UPDATE admin_mfa_challenges
               SET consumed_at = ?
               WHERE id = ? AND user_id = ? AND purpose = 'enrollment'
                 AND consumed_at = '' AND revoked_at = '' AND expires_at > ?
                 AND failed_attempt_count < 5 AND user_session_version = ?
                 AND changes() = 1`
            )
            .bind(now, input.challengeId, factor.user_id, now, input.expectedSessionVersion)
        );
      }
      const [firstRecoveryCode, ...remainingRecoveryCodes] = input.recoveryCodes;
      if (!firstRecoveryCode) throw new TypeError("recovery codes are required");
      statements.push(
        db
          .prepare(
            `INSERT INTO admin_mfa_recovery_codes (${ADMIN_MFA_RECOVERY_CODE_ROW_COLUMNS.join(", ")})
             VALUES (?, ?, CASE WHEN changes() = 1 THEN ? ELSE NULL END, ?, ?)`
          )
          .bind(
            firstRecoveryCode.id,
            firstRecoveryCode.user_id,
            firstRecoveryCode.code_hash,
            firstRecoveryCode.created_at,
            firstRecoveryCode.used_at
          ),
        db
          .prepare("DELETE FROM admin_mfa_recovery_codes WHERE user_id = ? AND id != ?")
          .bind(factor.user_id, firstRecoveryCode.id),
        ...insertRecoveryCodes(db, remainingRecoveryCodes),
        db
          .prepare(
            `UPDATE app_admin_users
             SET session_version = CASE WHEN session_version = ? AND EXISTS (
                   SELECT 1 FROM admin_mfa_totp
                   WHERE user_id = ? AND state = 'enabled' AND enabled_at = ?
                 ) ${consumedChallengeGuard}
                 THEN session_version + 1 ELSE NULL END,
                 updated_at = ?, revision = revision + 1
             WHERE id = ?
             RETURNING session_version`
          )
          .bind(input.expectedSessionVersion, factor.user_id, now, ...consumedChallengeBindings, now, factor.user_id),
        db
          .prepare(
            `UPDATE admin_sessions SET revoked_at = ?
             WHERE user_id = ? AND revoked_at = '' ${input.session ? "AND id != ?" : ""}`
          )
          .bind(now, factor.user_id, ...(input.session ? [input.session.id] : [])),
        db
          .prepare(
            `UPDATE admin_mfa_challenges SET revoked_at = ?
             WHERE user_id = ? AND consumed_at = '' AND revoked_at = ''`
          )
          .bind(now, factor.user_id)
      );
      if (input.session) {
        const session = { ...input.session, session_version: input.session.session_version + 1 };
        statements.push(
          guardedSessionInsert(
            db,
            session,
            `EXISTS (
               SELECT 1 FROM app_admin_users u
               JOIN admin_mfa_totp f ON f.user_id = u.id
               WHERE u.id = ? AND u.session_version = ? AND f.state = 'enabled'
             )`,
            [factor.user_id, session.session_version]
          )
        );
      }
      statements.push(insertAudit(db, entry));
      await db.batch(statements);
    },

    async regenerateRecoveryCodes(input) {
      if (input.recoveryCodes.length !== 10) {
        throw new TypeError("exactly ten recovery codes are required");
      }
      const entry = audit({
        action: "mfa.recovery_codes_regenerated",
        actor: input.actor,
        entityId: input.userId,
        now: input.now
      });
      const [firstRecoveryCode, ...remainingRecoveryCodes] = input.recoveryCodes;
      if (!firstRecoveryCode) throw new TypeError("recovery codes are required");
      await db.batch([
        db
          .prepare(
            `INSERT INTO admin_mfa_recovery_codes (${ADMIN_MFA_RECOVERY_CODE_ROW_COLUMNS.join(", ")})
             VALUES (?, ?, CASE WHEN EXISTS (
               SELECT 1 FROM admin_mfa_totp
               WHERE user_id = ? AND state = 'enabled'
             ) THEN ? ELSE NULL END, ?, ?)`
          )
          .bind(
            firstRecoveryCode.id,
            firstRecoveryCode.user_id,
            input.userId,
            firstRecoveryCode.code_hash,
            firstRecoveryCode.created_at,
            firstRecoveryCode.used_at
          ),
        db
          .prepare("DELETE FROM admin_mfa_recovery_codes WHERE user_id = ? AND id != ?")
          .bind(input.userId, firstRecoveryCode.id),
        ...insertRecoveryCodes(db, remainingRecoveryCodes),
        insertAudit(db, entry)
      ]);
    },

    async reauthenticateSession(input) {
      const statements = input.proof ? factorProofStatements(db, input.userId, input.proof, input.now) : [];
      const factorGuard = input.proof
        ? `AND changes() = 1 AND ${proofGuard(input.proof)}`
        : `AND NOT EXISTS (
             SELECT 1 FROM app_admin_users u
             WHERE u.id = ? AND (u.is_root = 1 OR u.mfa_required = 1)
           )
           AND NOT EXISTS (
             SELECT 1 FROM admin_mfa_totp f
             WHERE f.user_id = ? AND f.state = 'enabled'
           )`;
      const factorBindings = input.proof
        ? proofGuardBindings(input.userId, input.proof, input.now)
        : [input.userId, input.userId];
      const entry = audit({
        action: "session.reauthenticated",
        actor: input.actor,
        entityId: input.userId,
        now: input.now,
        metadata: { mfa: Boolean(input.proof) }
      });
      const recoveryEntry =
        input.proof?.type === "recovery"
          ? audit({
              action: "mfa.recovery_code_used",
              actor: input.actor,
              entityId: input.userId,
              now: input.now,
              metadata: { context: "reauthentication" }
            })
          : null;
      await db.batch([
        ...statements,
        db
          .prepare(
            `UPDATE admin_sessions
             SET reauthenticated_at = ?,
                 mfa_verified_at = CASE WHEN ? = 1 THEN ? ELSE mfa_verified_at END
             WHERE id = ? AND user_id = ? AND revoked_at = ''
               AND idle_expires_at > ? AND absolute_expires_at > ?
               AND session_version = (
                 SELECT session_version FROM app_admin_users WHERE id = ?
               )
               ${factorGuard}`
          )
          .bind(
            input.now,
            input.proof ? 1 : 0,
            input.now,
            input.sessionId,
            input.userId,
            input.now,
            input.now,
            input.userId,
            ...factorBindings
          ),
        db
          .prepare(
            `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
             VALUES (?, ?, ?, CASE WHEN changes() = 1 THEN ? ELSE NULL END, ?, ?, ?)`
          )
          .bind(
            entry.id,
            entry.entity_type,
            entry.entity_id,
            entry.action,
            entry.actor,
            entry.created_at,
            entry.metadata_json
          ),
        ...(recoveryEntry ? [insertAudit(db, recoveryEntry)] : [])
      ]);
    },

    async disableOwnMfa(input) {
      const entry = audit({ action: "mfa.disabled", actor: input.actor, entityId: input.userId, now: input.now });
      await db.batch([
        db
          .prepare(
            `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
             VALUES (?, ?, ?, CASE WHEN EXISTS (
               SELECT 1 FROM app_admin_users
               WHERE id = ? AND is_root = 0 AND mfa_required = 0
             ) AND EXISTS (
               SELECT 1 FROM admin_mfa_totp WHERE user_id = ? AND state = 'enabled'
             ) THEN ? ELSE NULL END, ?, ?, ?)`
          )
          .bind(
            entry.id,
            entry.entity_type,
            entry.entity_id,
            input.userId,
            input.userId,
            entry.action,
            entry.actor,
            entry.created_at,
            entry.metadata_json
          ),
        db.prepare("DELETE FROM admin_mfa_totp WHERE user_id = ?").bind(input.userId),
        db.prepare("DELETE FROM admin_mfa_recovery_codes WHERE user_id = ?").bind(input.userId),
        db
          .prepare(
            `UPDATE app_admin_users
             SET session_version = session_version + 1, updated_at = ?, revision = revision + 1
             WHERE id = ? AND is_root = 0 AND mfa_required = 0`
          )
          .bind(input.now, input.userId),
        db
          .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''")
          .bind(input.now, input.userId),
        db
          .prepare(
            "UPDATE admin_mfa_challenges SET revoked_at = ? WHERE user_id = ? AND consumed_at = '' AND revoked_at = ''"
          )
          .bind(input.now, input.userId)
      ]);
    },

    async setMfaRequirement(input) {
      const entry = audit({
        action: "mfa.requirement_changed",
        actor: input.actor,
        entityId: input.userId,
        now: input.now,
        metadata: { required: input.required }
      });
      try {
        await db.batch([
          db
            .prepare(
              `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
             VALUES (?, ?, ?, CASE WHEN EXISTS (
               SELECT 1 FROM app_admin_users
               WHERE id = ? AND revision = ? AND (? = 1 OR is_root = 0)
             ) THEN ? ELSE NULL END, ?, ?, ?)`
            )
            .bind(
              entry.id,
              entry.entity_type,
              entry.entity_id,
              input.userId,
              input.expectedRevision,
              input.required ? 1 : 0,
              entry.action,
              entry.actor,
              entry.created_at,
              entry.metadata_json
            ),
          db
            .prepare(
              `UPDATE app_admin_users
             SET mfa_required = ?, revision = revision + 1,
                 session_version = session_version + 1, updated_at = ?, updated_by = ?
             WHERE id = ? AND revision = ?
               AND (? = 1 OR is_root = 0)`
            )
            .bind(
              input.required ? 1 : 0,
              input.now,
              input.actor,
              input.userId,
              input.expectedRevision,
              input.required ? 1 : 0
            ),
          db
            .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''")
            .bind(input.now, input.userId),
          db
            .prepare(
              "UPDATE admin_mfa_challenges SET revoked_at = ? WHERE user_id = ? AND consumed_at = '' AND revoked_at = ''"
            )
            .bind(input.now, input.userId)
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/NOT NULL constraint failed:\s*admin_audit_log\.action/i.test(message)) {
          throw new AdminMfaConflict("stale_revision");
        }
        throw error;
      }
    },

    async resetMfaFactor(input) {
      const entry = audit({ action: "mfa.factor_reset", actor: input.actor, entityId: input.userId, now: input.now });
      try {
        await db.batch([
          db
            .prepare(
              `INSERT INTO admin_audit_log (${ADMIN_AUDIT_LOG_ROW_COLUMNS.join(", ")})
             VALUES (?, ?, ?, CASE WHEN EXISTS (
               SELECT 1 FROM admin_mfa_totp WHERE user_id = ? AND state = 'enabled'
             ) THEN ? ELSE NULL END, ?, ?, ?)`
            )
            .bind(
              entry.id,
              entry.entity_type,
              entry.entity_id,
              input.userId,
              entry.action,
              entry.actor,
              entry.created_at,
              entry.metadata_json
            ),
          db.prepare("DELETE FROM admin_mfa_totp WHERE user_id = ?").bind(input.userId),
          db.prepare("DELETE FROM admin_mfa_recovery_codes WHERE user_id = ?").bind(input.userId),
          db
            .prepare(
              `UPDATE app_admin_users
             SET session_version = session_version + 1, revision = revision + 1,
                 updated_at = ?, updated_by = ?
             WHERE id = ?`
            )
            .bind(input.now, input.actor, input.userId),
          db
            .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''")
            .bind(input.now, input.userId),
          db
            .prepare(
              "UPDATE admin_mfa_challenges SET revoked_at = ? WHERE user_id = ? AND consumed_at = '' AND revoked_at = ''"
            )
            .bind(input.now, input.userId)
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/NOT NULL constraint failed:\s*admin_audit_log\.action/i.test(message)) {
          throw new AdminMfaConflict("factor_missing");
        }
        throw error;
      }
    }
  };
}
