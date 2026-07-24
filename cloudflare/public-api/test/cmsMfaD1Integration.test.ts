// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdminMfaConflict, createAdminMfaRepository } from "../src/db/adminMfaRepository";
import { createAdminSessionRepository } from "../src/db/adminSessionRepository";
import { authenticateCmsSession } from "../src/auth/cmsSessionService";
import { hashCmsSessionToken } from "../src/auth/cmsSessionCrypto";
import type { AdminMfaChallengeRow, AdminMfaRecoveryCodeRow, AdminMfaTotpRow, AdminSessionRow } from "../src/db/schema";

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), "../migrations");
const migrationNames = readdirSync(migrationDirectory)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const baseTime = "2026-07-23T00:00:00.000Z";
let db: DatabaseSync;
let temporaryDirectory: string;

class SqliteD1Statement {
  private bindings: unknown[] = [];

  constructor(
    private readonly database: DatabaseSync,
    private readonly query: string
  ) {}

  bind(...values: unknown[]) {
    const statement = new SqliteD1Statement(this.database, this.query);
    statement.bindings = values;
    return statement;
  }

  first<T>() {
    return (this.database.prepare(this.query).get(...(this.bindings as never[])) as T | undefined) ?? null;
  }

  all<T>() {
    return {
      results: this.database.prepare(this.query).all(...(this.bindings as never[])) as T[],
      success: true
    };
  }

  run<T>() {
    if (/\bRETURNING\b/i.test(this.query)) {
      const results = this.database.prepare(this.query).all(...(this.bindings as never[])) as T[];
      return { results, success: true, meta: { changes: results.length } };
    }
    const result = this.database.prepare(this.query).run(...(this.bindings as never[]));
    return { results: [], success: true, meta: { changes: Number(result.changes) } };
  }
}

function d1Database() {
  return {
    prepare(query: string) {
      return new SqliteD1Statement(db, query);
    },
    async batch(statements: SqliteD1Statement[]) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.run());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  } as unknown as D1Database;
}

function repository() {
  return createAdminMfaRepository({ DB: d1Database() });
}

function insertUser(
  id: string,
  input: { isRoot?: boolean; mfaRequired?: boolean; revision?: number; sessionVersion?: number } = {}
) {
  db.prepare(
    `INSERT INTO app_admin_users
     (id,email,name,role,status,created_at,updated_at,created_by,updated_by,revision,
      is_root,mfa_required,session_version)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    `${id}@example.invalid`,
    id,
    input.isRoot ? "admin" : "viewer",
    "active",
    baseTime,
    baseTime,
    "fixture",
    "fixture",
    input.revision ?? 0,
    input.isRoot ? 1 : 0,
    input.mfaRequired ? 1 : 0,
    input.sessionVersion ?? 1
  );
}

function factor(userId: string, state: "enabled" | "pending" = "enabled"): AdminMfaTotpRow {
  return {
    user_id: userId,
    encrypted_secret: `ciphertext-for-${userId}`,
    iv: "fake-iv",
    key_version: "test-v1",
    state,
    created_at: "2026-07-23T00:01:00.000Z",
    enabled_at: state === "enabled" ? "2026-07-23T00:01:00.000Z" : "",
    updated_at: "2026-07-23T00:01:00.000Z",
    last_used_step: -1
  };
}

function insertFactor(row: AdminMfaTotpRow) {
  db.prepare(
    `INSERT INTO admin_mfa_totp
     (user_id,encrypted_secret,iv,key_version,state,created_at,enabled_at,updated_at,last_used_step)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    row.user_id,
    row.encrypted_secret,
    row.iv,
    row.key_version,
    row.state,
    row.created_at,
    row.enabled_at,
    row.updated_at,
    row.last_used_step
  );
}

function recoveryCodes(userId: string, prefix = "code"): AdminMfaRecoveryCodeRow[] {
  return Array.from({ length: 10 }, (_, index) => ({
    id: `${prefix}-${index}`,
    user_id: userId,
    code_hash: `${prefix}-hash-${index}`,
    created_at: "2026-07-23T00:02:00.000Z",
    used_at: ""
  }));
}

function insertRecoveryCode(row: AdminMfaRecoveryCodeRow) {
  db.prepare(
    `INSERT INTO admin_mfa_recovery_codes (id,user_id,code_hash,created_at,used_at)
     VALUES (?,?,?,?,?)`
  ).run(row.id, row.user_id, row.code_hash, row.created_at, row.used_at);
}

function challenge(userId: string, id: string, purpose: "enrollment" | "login" = "login"): AdminMfaChallengeRow {
  return {
    id,
    user_id: userId,
    token_hash: `${id}-hash`,
    purpose,
    created_at: "2026-07-23T00:02:00.000Z",
    expires_at: "2026-07-23T00:12:00.000Z",
    consumed_at: "",
    revoked_at: "",
    failed_attempt_count: 0,
    user_session_version: 1,
    ip_hash: "ip-hash",
    user_agent_hash: "user-agent-hash"
  };
}

function session(userId: string, id: string, sessionVersion = 1): AdminSessionRow {
  return {
    id,
    user_id: userId,
    token_hash: `${id}-token-hash`,
    csrf_token_hash: `${id}-csrf-hash`,
    created_at: "2026-07-23T00:03:00.000Z",
    last_seen_at: "2026-07-23T00:03:00.000Z",
    idle_expires_at: "2026-07-23T01:03:00.000Z",
    absolute_expires_at: "2026-07-23T08:03:00.000Z",
    session_version: sessionVersion,
    revoked_at: "",
    ip_hash: "ip-hash",
    user_agent_hash: "user-agent-hash",
    reauthenticated_at: "2026-07-23T00:03:00.000Z",
    mfa_verified_at: "2026-07-23T00:03:00.000Z"
  };
}

function insertSession(row: AdminSessionRow) {
  db.prepare(
    `INSERT INTO admin_sessions
     (id,user_id,token_hash,csrf_token_hash,created_at,last_seen_at,idle_expires_at,
      absolute_expires_at,session_version,revoked_at,ip_hash,user_agent_hash,
      reauthenticated_at,mfa_verified_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    row.id,
    row.user_id,
    row.token_hash,
    row.csrf_token_hash,
    row.created_at,
    row.last_seen_at,
    row.idle_expires_at,
    row.absolute_expires_at,
    row.session_version,
    row.revoked_at,
    row.ip_hash,
    row.user_agent_hash,
    row.reauthenticated_at,
    row.mfa_verified_at
  );
}

function scalar(query: string, ...bindings: unknown[]) {
  return Number((db.prepare(query).get(...(bindings as never[])) as { value: number }).value);
}

beforeEach(() => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "rcat-cms-mfa-"));
  db = new DatabaseSync(join(temporaryDirectory, "isolated.sqlite"));
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of migrationNames) {
    db.exec(readFileSync(join(migrationDirectory, name), "utf8"));
  }
});

afterEach(() => {
  db.close();
  rmSync(temporaryDirectory, { force: true, recursive: true });
});

describe("Phase 6 isolated D1 integration", () => {
  it("applies migration 0013 with exact tables, assurance columns, indexes, and cascading foreign keys", () => {
    expect(migrationNames.at(-1)).toBe("0013_cms_mfa_and_reauthentication.sql");
    const columns = (table: string) =>
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ dflt_value: string | null; name: string }>).map(
        ({ name }) => name
      );
    expect(columns("admin_mfa_totp")).toEqual([
      "user_id",
      "encrypted_secret",
      "iv",
      "key_version",
      "state",
      "created_at",
      "enabled_at",
      "updated_at",
      "last_used_step"
    ]);
    expect(columns("admin_mfa_recovery_codes")).toEqual(["id", "user_id", "code_hash", "created_at", "used_at"]);
    expect(columns("admin_mfa_challenges")).toEqual([
      "id",
      "user_id",
      "token_hash",
      "purpose",
      "created_at",
      "expires_at",
      "consumed_at",
      "revoked_at",
      "failed_attempt_count",
      "user_session_version",
      "ip_hash",
      "user_agent_hash"
    ]);
    const sessionColumns = db.prepare("PRAGMA table_info(admin_sessions)").all() as Array<{
      dflt_value: string | null;
      name: string;
    }>;
    expect(sessionColumns.find(({ name }) => name === "reauthenticated_at")?.dflt_value).toBe("''");
    expect(sessionColumns.find(({ name }) => name === "mfa_verified_at")?.dflt_value).toBe("''");
    for (const table of ["admin_mfa_totp", "admin_mfa_recovery_codes", "admin_mfa_challenges"]) {
      expect(
        (db.prepare(`PRAGMA foreign_key_list(${table})`).all() as Array<{ on_delete: string }>)[0]?.on_delete
      ).toBe("CASCADE");
    }
    const indexNames = (table: string) =>
      (db.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string }>).map(({ name }) => name);
    expect(indexNames("admin_mfa_recovery_codes")).toEqual(
      expect.arrayContaining([
        "idx_admin_mfa_recovery_codes_user",
        "idx_admin_mfa_recovery_codes_unused",
        "idx_admin_mfa_recovery_codes_used_cleanup"
      ])
    );
    expect(indexNames("admin_mfa_challenges")).toEqual(
      expect.arrayContaining([
        "idx_admin_mfa_challenges_token_active",
        "idx_admin_mfa_challenges_user_active",
        "idx_admin_mfa_challenges_expires",
        "idx_admin_mfa_challenges_cleanup"
      ])
    );
  });

  it("enforces factor state, challenge expiry, failure bounds, and foreign-key cascades", () => {
    insertUser("constraints");
    insertFactor(factor("constraints", "pending"));
    expect(() => insertFactor({ ...factor("constraints"), user_id: "missing" })).toThrow();
    db.prepare("DELETE FROM admin_mfa_totp WHERE user_id = ?").run("constraints");
    expect(() => insertFactor({ ...factor("constraints", "enabled"), enabled_at: "" })).toThrow();
    const invalidExpiry = { ...challenge("constraints", "equal-expiry"), expires_at: "2026-07-23T00:02:00.000Z" };
    expect(() =>
      db
        .prepare("INSERT INTO admin_mfa_challenges VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(...(Object.values(invalidExpiry) as never[]))
    ).toThrow();
    const invalidFailures = { ...challenge("constraints", "six-failures"), failed_attempt_count: 6 };
    expect(() =>
      db
        .prepare("INSERT INTO admin_mfa_challenges VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(...(Object.values(invalidFailures) as never[]))
    ).toThrow();
    insertFactor(factor("constraints"));
    insertRecoveryCode(recoveryCodes("constraints")[0]);
    db.prepare("DELETE FROM app_admin_users WHERE id = ?").run("constraints");
    expect(scalar("SELECT COUNT(*) AS value FROM admin_mfa_totp")).toBe(0);
    expect(scalar("SELECT COUNT(*) AS value FROM admin_mfa_recovery_codes")).toBe(0);
  });

  it("stores a pending ciphertext and atomically enables it with ten recovery-code hashes", async () => {
    insertUser("enrollment");
    const pending = factor("enrollment", "pending");
    await repository().replacePendingFactor(pending, "enrollment@example.invalid", pending.updated_at);
    const storedPending = db.prepare("SELECT * FROM admin_mfa_totp WHERE user_id = ?").get("enrollment") as {
      encrypted_secret: string;
      state: string;
    };
    expect(storedPending).toMatchObject({ encrypted_secret: pending.encrypted_secret, state: "pending" });
    expect(Object.keys(storedPending)).not.toContain("secret");
    const codes = recoveryCodes("enrollment", "enrollment-code");
    const enrollmentChallenge = challenge("enrollment", "enrollment-challenge", "enrollment");
    await repository().createChallenge(enrollmentChallenge, "enrollment@example.invalid");
    await repository().confirmEnrollment({
      challengeId: enrollmentChallenge.id,
      factor: pending,
      expectedSessionVersion: 1,
      matchedStep: 100,
      recoveryCodes: codes,
      session: session("enrollment", "enrollment-session"),
      actor: "enrollment@example.invalid",
      now: "2026-07-23T00:02:00.000Z"
    });
    expect(
      db.prepare("SELECT state,last_used_step FROM admin_mfa_totp WHERE user_id = ?").get("enrollment")
    ).toMatchObject({ last_used_step: 100, state: "enabled" });
    expect(scalar("SELECT COUNT(*) AS value FROM admin_mfa_recovery_codes WHERE user_id = ?", "enrollment")).toBe(10);
    expect(
      scalar(
        "SELECT COUNT(*) AS value FROM admin_mfa_recovery_codes WHERE user_id = ? AND code_hash LIKE ?",
        "enrollment",
        "enrollment-code-hash-%"
      )
    ).toBe(10);
    expect(db.prepare("SELECT consumed_at FROM admin_mfa_challenges WHERE id = ?").get(enrollmentChallenge.id)).toEqual(
      {
        consumed_at: "2026-07-23T00:02:00.000Z"
      }
    );
    expect(db.prepare("SELECT session_version FROM admin_sessions WHERE id = ?").get("enrollment-session")).toEqual({
      session_version: 2
    });
  });

  it("revokes the old Session after voluntary enrollment", async () => {
    insertUser("voluntary-enrollment");
    const pending = factor("voluntary-enrollment", "pending");
    insertSession({
      ...session("voluntary-enrollment", "voluntary-old-session"),
      mfa_verified_at: ""
    });
    await repository().replacePendingFactor(pending, "voluntary-enrollment@example.invalid", pending.updated_at);
    await repository().confirmEnrollment({
      factor: pending,
      expectedSessionVersion: 1,
      matchedStep: 100,
      recoveryCodes: recoveryCodes("voluntary-enrollment", "voluntary-code"),
      actor: "voluntary-enrollment@example.invalid",
      now: "2026-07-23T00:05:00.000Z"
    });

    expect(db.prepare("SELECT revoked_at FROM admin_sessions WHERE id = ?").get("voluntary-old-session")).toEqual({
      revoked_at: "2026-07-23T00:05:00.000Z"
    });
    expect(db.prepare("SELECT session_version FROM app_admin_users WHERE id = ?").get("voluntary-enrollment")).toEqual({
      session_version: 2
    });
  });

  it("rejects a replayed TOTP step through real guarded repository SQL", async () => {
    insertUser("totp-replay");
    insertFactor(factor("totp-replay"));
    const firstChallenge = challenge("totp-replay", "totp-challenge-1");
    await repository().createChallenge(firstChallenge, "totp-replay@example.invalid");
    await repository().completeLoginChallenge({
      challenge: firstChallenge,
      proof: { matchedStep: 100, type: "totp" },
      session: session("totp-replay", "totp-session-1"),
      actor: "totp-replay@example.invalid",
      now: "2026-07-23T00:03:00.000Z"
    });
    const secondChallenge = challenge("totp-replay", "totp-challenge-2");
    await repository().createChallenge(secondChallenge, "totp-replay@example.invalid");
    await expect(
      repository().completeLoginChallenge({
        challenge: secondChallenge,
        proof: { matchedStep: 100, type: "totp" },
        session: session("totp-replay", "totp-session-2"),
        actor: "totp-replay@example.invalid",
        now: "2026-07-23T00:04:00.000Z"
      })
    ).rejects.toThrow();
    expect(scalar("SELECT COUNT(*) AS value FROM admin_sessions WHERE user_id = ?", "totp-replay")).toBe(1);
    expect(
      db.prepare("SELECT consumed_at FROM admin_mfa_challenges WHERE id = ?").get(secondChallenge.id)
    ).toMatchObject({ consumed_at: "" });
  });

  it("consumes a Recovery Code once even when a replay uses the same timestamp", async () => {
    insertUser("recovery-replay");
    insertFactor(factor("recovery-replay"));
    const code = recoveryCodes("recovery-replay", "recovery")[0];
    insertRecoveryCode(code);
    const firstChallenge = challenge("recovery-replay", "recovery-challenge-1");
    await repository().createChallenge(firstChallenge, "recovery-replay@example.invalid");
    const now = "2026-07-23T00:03:00.000Z";
    await repository().completeLoginChallenge({
      challenge: firstChallenge,
      proof: { codeHash: code.code_hash, recoveryCodeId: code.id, type: "recovery" },
      session: session("recovery-replay", "recovery-session-1"),
      actor: "recovery-replay@example.invalid",
      now
    });
    const secondChallenge = challenge("recovery-replay", "recovery-challenge-2");
    await repository().createChallenge(secondChallenge, "recovery-replay@example.invalid");
    await expect(
      repository().completeLoginChallenge({
        challenge: secondChallenge,
        proof: { codeHash: code.code_hash, recoveryCodeId: code.id, type: "recovery" },
        session: session("recovery-replay", "recovery-session-2"),
        actor: "recovery-replay@example.invalid",
        now
      })
    ).rejects.toThrow();
    expect(scalar("SELECT COUNT(*) AS value FROM admin_sessions WHERE user_id = ?", "recovery-replay")).toBe(1);
  });

  it("cannot consume one challenge twice even with a fresh TOTP step at the same timestamp", async () => {
    insertUser("challenge-replay");
    insertFactor(factor("challenge-replay"));
    const loginChallenge = challenge("challenge-replay", "single-challenge");
    const now = "2026-07-23T00:03:00.000Z";
    await repository().createChallenge(loginChallenge, "challenge-replay@example.invalid");
    await repository().completeLoginChallenge({
      challenge: loginChallenge,
      proof: { matchedStep: 100, type: "totp" },
      session: session("challenge-replay", "challenge-session-1"),
      actor: "challenge-replay@example.invalid",
      now
    });
    await expect(
      repository().completeLoginChallenge({
        challenge: loginChallenge,
        proof: { matchedStep: 101, type: "totp" },
        session: session("challenge-replay", "challenge-session-2"),
        actor: "challenge-replay@example.invalid",
        now
      })
    ).rejects.toThrow();
    expect(db.prepare("SELECT last_used_step FROM admin_mfa_totp WHERE user_id = ?").get("challenge-replay")).toEqual({
      last_used_step: 100
    });
  });

  it("permanently closes a challenge on its fifth failed attempt", async () => {
    insertUser("five-failures");
    const loginChallenge = challenge("five-failures", "failure-challenge");
    await repository().createChallenge(loginChallenge, "five-failures@example.invalid");
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await repository().recordChallengeFailure(loginChallenge.id, `2026-07-23T00:0${attempt + 2}:00.000Z`);
    }
    expect(
      db.prepare("SELECT failed_attempt_count,revoked_at FROM admin_mfa_challenges WHERE id = ?").get(loginChallenge.id)
    ).toEqual({ failed_attempt_count: 5, revoked_at: "2026-07-23T00:07:00.000Z" });
    await repository().recordChallengeFailure(loginChallenge.id, "2026-07-23T00:08:00.000Z");
    expect(
      db.prepare("SELECT failed_attempt_count FROM admin_mfa_challenges WHERE id = ?").get(loginChallenge.id)
    ).toEqual({ failed_attempt_count: 5 });
  });

  it("queries and authenticates a migration-era password Session with empty assurance", async () => {
    const token = "A".repeat(43);
    const tokenHash = await hashCmsSessionToken(token);
    insertUser("migration-session");
    insertSession({
      ...session("migration-session", "migration-session-1"),
      token_hash: tokenHash,
      reauthenticated_at: "",
      mfa_verified_at: ""
    });

    const stored = await createAdminSessionRepository({ DB: d1Database() }).findSessionByTokenHash(tokenHash);
    const authenticated = await authenticateCmsSession({
      env: { DB: d1Database() },
      sessionToken: token,
      method: "GET",
      now: new Date("2026-07-23T00:05:00.000Z")
    });

    expect(stored).toMatchObject({
      effectiveMfa: false,
      session: { id: "migration-session-1", reauthenticated_at: "", mfa_verified_at: "" }
    });
    expect(authenticated).toMatchObject({
      status: "authenticated",
      identity: { sessionId: "migration-session-1", reauthenticatedAt: "" }
    });
  });

  it("invalidates an effective-MFA Session that has no MFA assurance", async () => {
    const token = "B".repeat(43);
    const tokenHash = await hashCmsSessionToken(token);
    insertUser("mfa-session", { mfaRequired: true });
    insertSession({
      ...session("mfa-session", "mfa-session-1"),
      token_hash: tokenHash,
      mfa_verified_at: ""
    });

    const stored = await createAdminSessionRepository({ DB: d1Database() }).findSessionByTokenHash(tokenHash);
    const authenticated = await authenticateCmsSession({
      env: { DB: d1Database() },
      sessionToken: token,
      method: "GET",
      now: new Date("2026-07-23T00:05:00.000Z")
    });

    expect(stored?.effectiveMfa).toBe(true);
    expect(stored?.session.mfa_verified_at).toBe("");
    expect(authenticated).toEqual({ status: "unauthenticated" });
  });

  it("updates assurance only on the current Session", async () => {
    insertUser("reauth");
    insertSession({ ...session("reauth", "reauth-session-1"), reauthenticated_at: "", mfa_verified_at: "" });
    insertSession({ ...session("reauth", "reauth-session-2"), reauthenticated_at: "", mfa_verified_at: "" });
    await repository().reauthenticateSession({
      sessionId: "reauth-session-1",
      userId: "reauth",
      actor: "reauth@example.invalid",
      now: "2026-07-23T00:05:00.000Z"
    });
    expect(
      db.prepare("SELECT id,reauthenticated_at FROM admin_sessions WHERE user_id = ? ORDER BY id").all("reauth")
    ).toEqual([
      { id: "reauth-session-1", reauthenticated_at: "2026-07-23T00:05:00.000Z" },
      { id: "reauth-session-2", reauthenticated_at: "" }
    ]);
  });

  it("rolls back factor proof when the Session assurance update cannot be applied", async () => {
    insertUser("reauth-rollback", { mfaRequired: true });
    insertFactor(factor("reauth-rollback"));

    await expect(
      repository().reauthenticateSession({
        sessionId: "missing-session",
        userId: "reauth-rollback",
        proof: { type: "totp", matchedStep: 42 },
        actor: "reauth-rollback@example.invalid",
        now: "2026-07-23T00:05:00.000Z"
      })
    ).rejects.toThrow();

    expect(db.prepare("SELECT last_used_step FROM admin_mfa_totp WHERE user_id = ?").get("reauth-rollback")).toEqual({
      last_used_step: -1
    });
    expect(
      scalar(
        "SELECT COUNT(*) AS value FROM admin_audit_log WHERE entity_id = ? AND action = ?",
        "reauth-rollback",
        "session.reauthenticated"
      )
    ).toBe(0);
  });

  it("changes the MFA requirement while revoking Sessions and active Challenges", async () => {
    insertUser("requirement");
    insertSession(session("requirement", "requirement-session"));
    const activeChallenge = challenge("requirement", "requirement-challenge");
    await repository().createChallenge(activeChallenge, "requirement@example.invalid");
    await repository().setMfaRequirement({
      userId: "requirement",
      required: true,
      expectedRevision: 0,
      actor: "admin@example.invalid",
      now: "2026-07-23T00:05:00.000Z"
    });
    expect(
      db.prepare("SELECT mfa_required,revision,session_version FROM app_admin_users WHERE id = ?").get("requirement")
    ).toEqual({ mfa_required: 1, revision: 1, session_version: 2 });
    expect(db.prepare("SELECT revoked_at FROM admin_sessions WHERE id = ?").get("requirement-session")).toEqual({
      revoked_at: "2026-07-23T00:05:00.000Z"
    });
    expect(db.prepare("SELECT revoked_at FROM admin_mfa_challenges WHERE id = ?").get(activeChallenge.id)).toEqual({
      revoked_at: "2026-07-23T00:05:00.000Z"
    });
  });

  it("resets a factor while retaining policy and revoking Sessions, Challenges, and Recovery Codes", async () => {
    insertUser("factor-reset", { mfaRequired: true });
    insertFactor(factor("factor-reset"));
    insertRecoveryCode(recoveryCodes("factor-reset")[0]);
    insertSession(session("factor-reset", "reset-session"));
    const activeChallenge = challenge("factor-reset", "reset-challenge");
    await repository().createChallenge(activeChallenge, "factor-reset@example.invalid");
    await repository().resetMfaFactor({
      userId: "factor-reset",
      actor: "admin@example.invalid",
      now: "2026-07-23T00:05:00.000Z"
    });
    expect(scalar("SELECT COUNT(*) AS value FROM admin_mfa_totp WHERE user_id = ?", "factor-reset")).toBe(0);
    expect(scalar("SELECT COUNT(*) AS value FROM admin_mfa_recovery_codes WHERE user_id = ?", "factor-reset")).toBe(0);
    expect(
      db.prepare("SELECT mfa_required,session_version FROM app_admin_users WHERE id = ?").get("factor-reset")
    ).toEqual({ mfa_required: 1, session_version: 2 });
    expect(db.prepare("SELECT revoked_at FROM admin_sessions WHERE id = ?").get("reset-session")).toEqual({
      revoked_at: "2026-07-23T00:05:00.000Z"
    });
    expect(db.prepare("SELECT revoked_at FROM admin_mfa_challenges WHERE id = ?").get(activeChallenge.id)).toEqual({
      revoked_at: "2026-07-23T00:05:00.000Z"
    });
  });

  it("rolls back factor, codes, Session state, user version, and audit on a forced enrollment failure", async () => {
    insertUser("rollback");
    const pending = factor("rollback", "pending");
    insertFactor(pending);
    insertSession(session("rollback", "rollback-session"));
    const codes = recoveryCodes("rollback", "duplicate");
    codes[1] = { ...codes[1], code_hash: codes[0].code_hash };
    await expect(
      repository().confirmEnrollment({
        factor: pending,
        expectedSessionVersion: 1,
        matchedStep: 100,
        recoveryCodes: codes,
        actor: "rollback@example.invalid",
        now: "2026-07-23T00:02:00.000Z"
      })
    ).rejects.toThrow();
    expect(db.prepare("SELECT state,last_used_step FROM admin_mfa_totp WHERE user_id = ?").get("rollback")).toEqual({
      last_used_step: -1,
      state: "pending"
    });
    expect(scalar("SELECT COUNT(*) AS value FROM admin_mfa_recovery_codes WHERE user_id = ?", "rollback")).toBe(0);
    expect(db.prepare("SELECT session_version FROM app_admin_users WHERE id = ?").get("rollback")).toEqual({
      session_version: 1
    });
    expect(db.prepare("SELECT revoked_at FROM admin_sessions WHERE id = ?").get("rollback-session")).toEqual({
      revoked_at: ""
    });
    expect(
      scalar(
        "SELECT COUNT(*) AS value FROM admin_audit_log WHERE entity_id = ? AND action = ?",
        "rollback",
        "mfa.enabled"
      )
    ).toBe(0);
  });

  it("preserves Root constraints and rejects removal of the Root MFA requirement", async () => {
    insertUser("root-user", { isRoot: true, mfaRequired: true });
    await expect(
      repository().setMfaRequirement({
        userId: "root-user",
        required: false,
        expectedRevision: 0,
        actor: "root-user@example.invalid",
        now: "2026-07-23T00:05:00.000Z"
      })
    ).rejects.toBeInstanceOf(AdminMfaConflict);
    expect(
      db
        .prepare("SELECT is_root,mfa_required,revision,session_version FROM app_admin_users WHERE id = ?")
        .get("root-user")
    ).toEqual({ is_root: 1, mfa_required: 1, revision: 0, session_version: 1 });
    expect(() => db.prepare("UPDATE app_admin_users SET role = 'viewer' WHERE id = ?").run("root-user")).toThrow(
      "root administrator is protected"
    );
  });
});
