import type { Env } from "../env";
import {
  createAdminAuthRepository,
  normalizeCmsIdentifier,
  type AdminAuthRepository,
  type FailedPasswordAttemptState
} from "../db/adminAuthRepository";
import type { AdminAuthUserRow } from "../db/schema";
import { CMS_PASSWORD_ALGORITHM, performCmsDummyPasswordComparison, verifyCmsPassword } from "./cmsPassword";

export interface CmsAuthenticatedIdentity {
  id: string;
  email: string;
  name: string;
  username: string | null;
  role: AdminAuthUserRow["role"];
  isRoot: boolean;
  mustChangePassword: boolean;
  mfaRequired: boolean;
  sessionVersion: number;
}

export type CmsCredentialVerificationResult =
  | { status: "success"; identity: CmsAuthenticatedIdentity }
  | { status: "invalid" }
  | { status: "locked"; retryAfterSeconds: number }
  | { status: "unavailable" };

export interface VerifyCmsCredentialInput {
  env: Env;
  identifier: string;
  password: string;
  now?: Date;
  repository?: AdminAuthRepository;
  verifyPassword?: (password: string, storedHash: string, algorithm: string) => Promise<boolean>;
  compareDummyPassword?: (password: string) => Promise<boolean>;
}

function getRetryAfterSeconds(lockedUntil: string, now: Date) {
  const lockedUntilMs = Date.parse(lockedUntil);

  if (!Number.isFinite(lockedUntilMs) || lockedUntilMs <= now.getTime()) {
    return 0;
  }

  return Math.min(60 * 60, Math.max(1, Math.ceil((lockedUntilMs - now.getTime()) / 1000)));
}

function lockoutResult(state: FailedPasswordAttemptState | null, now: Date): CmsCredentialVerificationResult {
  if (!state) {
    return { status: "unavailable" };
  }

  const retryAfterSeconds = getRetryAfterSeconds(state.lockedUntil, now);
  return retryAfterSeconds > 0 ? { status: "locked", retryAfterSeconds } : { status: "invalid" };
}

function toSafeIdentity(user: AdminAuthUserRow): CmsAuthenticatedIdentity {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    isRoot: user.is_root === 1,
    mustChangePassword: user.must_change_password === 1,
    mfaRequired: user.mfa_required === 1,
    sessionVersion: user.session_version
  };
}

export async function verifyCmsCredential(input: VerifyCmsCredentialInput): Promise<CmsCredentialVerificationResult> {
  const repository = input.repository ?? createAdminAuthRepository(input.env);
  const verifyPassword = input.verifyPassword ?? verifyCmsPassword;
  const compareDummyPassword = input.compareDummyPassword ?? performCmsDummyPasswordComparison;
  const now = input.now ?? new Date();
  const normalizedIdentifier = normalizeCmsIdentifier(input.identifier);

  try {
    if (!normalizedIdentifier) {
      await compareDummyPassword(input.password);
      return { status: "invalid" };
    }

    const users = await repository.findAuthenticationUsersByIdentifier(normalizedIdentifier);

    if (users.length !== 1) {
      await compareDummyPassword(input.password);
      return { status: "invalid" };
    }

    const user = users[0];

    if (user.status !== "active") {
      await compareDummyPassword(input.password);
      return { status: "invalid" };
    }

    const credential = await repository.getCredentialByUserId(user.id);

    if (!credential || credential.password_algorithm !== CMS_PASSWORD_ALGORITHM) {
      await compareDummyPassword(input.password);
      return { status: "invalid" };
    }

    const existingRetryAfterSeconds = getRetryAfterSeconds(credential.locked_until, now);

    if (existingRetryAfterSeconds > 0) {
      await compareDummyPassword(input.password);
      return { status: "locked", retryAfterSeconds: existingRetryAfterSeconds };
    }

    const passwordMatches = await verifyPassword(
      input.password,
      credential.password_hash,
      credential.password_algorithm
    );

    if (!passwordMatches) {
      const state = await repository.recordFailedPasswordAttempt(user.id, now);
      return lockoutResult(state, now);
    }

    await repository.clearFailedPasswordAttempts(user.id, now);
    return { status: "success", identity: toSafeIdentity(user) };
  } catch {
    await compareDummyPassword(input.password).catch(() => false);
    return { status: "unavailable" };
  }
}
