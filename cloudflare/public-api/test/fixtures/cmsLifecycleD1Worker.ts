import { hashInvitationToken, hashPasswordResetToken } from "../../src/auth/cmsLifecycleToken";
import {
  CMS_INVITATION_LIFETIME_SECONDS,
  CMS_PASSWORD_RESET_LIFETIME_SECONDS,
  createAdminUserLifecycleRepository
} from "../../src/db/adminUserLifecycleRepository";
import type { AdminPasswordResetTokenRow, AdminUserInvitationRow } from "../../src/db/schema";
import type { Env } from "../../src/env";

const now = "2026-07-22T06:00:00.000Z";
const actor = "integration-admin@example.test";
const algorithm = "bcrypt-sha384-v1";

function future(seconds: number) {
  return new Date(Date.parse(now) + seconds * 1_000).toISOString();
}

function invitation(id: string, userId: string, tokenHash: string, createdBy = actor): AdminUserInvitationRow {
  return {
    id,
    user_id: userId,
    token_hash: tokenHash,
    created_by: createdBy,
    created_at: now,
    expires_at: future(CMS_INVITATION_LIFETIME_SECONDS),
    accepted_at: "",
    revoked_at: "",
    request_ip_hash: ""
  };
}

function resetToken(id: string, userId: string, tokenHash: string): AdminPasswordResetTokenRow {
  return {
    id,
    user_id: userId,
    token_hash: tokenHash,
    created_at: now,
    expires_at: future(CMS_PASSWORD_RESET_LIFETIME_SECONDS),
    used_at: "",
    revoked_at: "",
    request_ip_hash: ""
  };
}

async function first<T>(db: D1Database, sql: string, ...bindings: unknown[]) {
  return db
    .prepare(sql)
    .bind(...bindings)
    .first<T>();
}

async function count(db: D1Database, table: string, clause: string, ...bindings: unknown[]) {
  const row = await first<{ total: number }>(db, `SELECT COUNT(*) AS total FROM ${table} WHERE ${clause}`, ...bindings);
  return Number(row?.total ?? 0);
}

export async function runScenarios(env: Env) {
  const repository = createAdminUserLifecycleRepository(env);
  const invitationRaw = "I".repeat(43);
  const invitationHash = await hashInvitationToken(invitationRaw);
  const resetRaw = "R".repeat(43);
  const resetHash = await hashPasswordResetToken(resetRaw);

  await env.DB!.exec(`CREATE TRIGGER integration_fail_invitation
    BEFORE INSERT ON admin_user_invitations
    WHEN NEW.created_by = 'force-rollback'
    BEGIN SELECT RAISE(ABORT, 'forced integration rollback'); END`);
  let atomicCreateRejected = false;

  try {
    await repository.createUserWithInvitation({
      user: {
        id: "atomic-rollback-user",
        email: "atomic-rollback@example.test",
        name: "Atomic Rollback",
        role: "viewer",
        username: null
      },
      invitation: invitation("atomic-rollback-invitation", "atomic-rollback-user", invitationHash, "force-rollback"),
      actor: "force-rollback",
      now
    });
  } catch {
    atomicCreateRejected = true;
  }

  const atomicRollback = {
    rejected: atomicCreateRejected,
    users: await count(env.DB!, "app_admin_users", "id = ?", "atomic-rollback-user"),
    invitations: await count(env.DB!, "admin_user_invitations", "user_id = ?", "atomic-rollback-user"),
    audits: await count(env.DB!, "admin_audit_log", "entity_id = ?", "atomic-rollback-user")
  };
  await env.DB!.exec("DROP TRIGGER integration_fail_invitation");

  await repository.createUserWithInvitation({
    user: {
      id: "accepted-user",
      email: "accepted@example.test",
      name: "Accepted User",
      role: "editor",
      username: null
    },
    invitation: invitation("accepted-invitation", "accepted-user", invitationHash),
    actor,
    now
  });

  const created = {
    users: await count(env.DB!, "app_admin_users", "id = ?", "accepted-user"),
    invitations: await count(env.DB!, "admin_user_invitations", "user_id = ?", "accepted-user"),
    credentials: await count(env.DB!, "admin_credentials", "user_id = ?", "accepted-user"),
    invitedAudits: await count(
      env.DB!,
      "admin_audit_log",
      "entity_id = ? AND action = 'user.invited'",
      "accepted-user"
    ),
    storedTokenHash: (
      await first<{ token_hash: string }>(
        env.DB!,
        "SELECT token_hash FROM admin_user_invitations WHERE id = ?",
        "accepted-invitation"
      )
    )?.token_hash
  };

  const acceptanceInput = {
    invitationId: "accepted-invitation",
    userId: "accepted-user",
    tokenHash: invitationHash,
    passwordHash: "accepted-password-hash",
    passwordAlgorithm: algorithm,
    username: "accepted.user",
    expectedUsername: null,
    actor: "accepted@example.test",
    now
  };
  await repository.acceptInvitation(acceptanceInput);
  let secondAcceptanceRejected = false;

  try {
    await repository.acceptInvitation({ ...acceptanceInput, passwordHash: "second-acceptance-hash" });
  } catch {
    secondAcceptanceRejected = true;
  }

  const acceptedCredential = await first<{ password_hash: string }>(
    env.DB!,
    "SELECT password_hash FROM admin_credentials WHERE user_id = ?",
    "accepted-user"
  );
  const acceptedInvitation = await first<{ accepted_at: string }>(
    env.DB!,
    "SELECT accepted_at FROM admin_user_invitations WHERE id = ?",
    "accepted-invitation"
  );
  const accepted = {
    credentials: await count(env.DB!, "admin_credentials", "user_id = ?", "accepted-user"),
    passwordHash: acceptedCredential?.password_hash,
    acceptedAt: acceptedInvitation?.accepted_at,
    acceptedAudits: await count(
      env.DB!,
      "admin_audit_log",
      "entity_id = ? AND action = 'user.invitation_accepted'",
      "accepted-user"
    ),
    secondRejected: secondAcceptanceRejected
  };

  await repository.issuePasswordReset({
    userId: "accepted-user",
    actor,
    token: resetToken("accepted-reset", "accepted-user", resetHash),
    now
  });
  const resetInput = {
    resetTokenId: "accepted-reset",
    userId: "accepted-user",
    tokenHash: resetHash,
    passwordHash: "reset-password-hash",
    passwordAlgorithm: algorithm,
    actor: "accepted@example.test",
    now
  };
  await repository.completePasswordReset(resetInput);
  let secondResetRejected = false;

  try {
    await repository.completePasswordReset({ ...resetInput, passwordHash: "second-reset-hash" });
  } catch {
    secondResetRejected = true;
  }

  const completedCredential = await first<{ password_hash: string }>(
    env.DB!,
    "SELECT password_hash FROM admin_credentials WHERE user_id = ?",
    "accepted-user"
  );
  const completedReset = await first<{ token_hash: string; used_at: string }>(
    env.DB!,
    "SELECT token_hash, used_at FROM admin_password_reset_tokens WHERE id = ?",
    "accepted-reset"
  );
  const reset = {
    passwordHash: completedCredential?.password_hash,
    storedTokenHash: completedReset?.token_hash,
    usedAt: completedReset?.used_at,
    resetAudits: await count(
      env.DB!,
      "admin_audit_log",
      "entity_id = ? AND action = 'credential.password_reset'",
      "accepted-user"
    ),
    secondRejected: secondResetRejected
  };

  const failedRaw = "F".repeat(43);
  const failedHash = await hashInvitationToken(failedRaw);
  await repository.createUserWithInvitation({
    user: {
      id: "failed-eligibility-user",
      email: "failed-eligibility@example.test",
      name: "Failed Eligibility",
      role: "viewer",
      username: null
    },
    invitation: invitation("failed-eligibility-invitation", "failed-eligibility-user", failedHash),
    actor,
    now
  });
  let failedEligibilityRejected = false;

  try {
    await repository.acceptInvitation({
      invitationId: "failed-eligibility-invitation",
      userId: "failed-eligibility-user",
      tokenHash: await hashInvitationToken("X".repeat(43)),
      passwordHash: "must-not-be-stored",
      passwordAlgorithm: algorithm,
      username: "must.not.persist",
      expectedUsername: null,
      actor: "failed-eligibility@example.test",
      now
    });
  } catch {
    failedEligibilityRejected = true;
  }

  const failedUser = await first<{
    must_change_password: number;
    revision: number;
    session_version: number;
    username: string | null;
  }>(
    env.DB!,
    "SELECT must_change_password, revision, session_version, username FROM app_admin_users WHERE id = ?",
    "failed-eligibility-user"
  );
  const failedInvitation = await first<{ accepted_at: string; revoked_at: string; token_hash: string }>(
    env.DB!,
    "SELECT accepted_at, revoked_at, token_hash FROM admin_user_invitations WHERE id = ?",
    "failed-eligibility-invitation"
  );
  const failedEligibility = {
    rejected: failedEligibilityRejected,
    user: failedUser,
    credentials: await count(env.DB!, "admin_credentials", "user_id = ?", "failed-eligibility-user"),
    invitation: failedInvitation,
    acceptedAudits: await count(
      env.DB!,
      "admin_audit_log",
      "entity_id = ? AND action = 'user.invitation_accepted'",
      "failed-eligibility-user"
    )
  };

  return {
    rawTokens: { invitationRaw, resetRaw, failedRaw },
    hashes: { invitationHash, resetHash, failedHash },
    atomicRollback,
    created,
    accepted,
    reset,
    failedEligibility
  };
}
