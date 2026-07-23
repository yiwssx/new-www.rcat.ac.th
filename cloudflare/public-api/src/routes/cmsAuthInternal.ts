import { constantTimeTextEqual, isValidCmsToken } from "../auth/cmsSessionCrypto";
import { hasAdminCapability } from "../auth/adminCapabilities";
import { hasRecentAdminAssurance } from "../auth/adminStepUp";
import { createCmsMfaChallenge, resolveMfaFactorProof, validateCmsMfaChallenge } from "../auth/cmsMfaService";
import { decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes, hashRecoveryCode } from "../auth/cmsMfaCrypto";
import { createTotpUri, generateTotpSecret, verifyTotpCode } from "../auth/cmsTotp";
import { isValidMfaChallengeToken } from "../auth/cmsMfaChallenge";
import { hashInvitationToken, hashPasswordResetToken, isValidLifecycleToken } from "../auth/cmsLifecycleToken";
import { CMS_PASSWORD_ALGORITHM, hashCmsPassword, validateCmsPassword, verifyCmsPassword } from "../auth/cmsPassword";
import {
  CmsSessionEligibilityError,
  authenticateCmsSession,
  createCmsSession,
  prepareCmsSession,
  revokeAllCmsSessions,
  revokeCmsSession,
  type AuthenticateCmsSessionInput,
  type CreateCmsSessionInput
} from "../auth/cmsSessionService";
import { verifyCmsCredential, type VerifyCmsCredentialInput } from "../auth/cmsCredentialService";
import {
  AdminUserLifecycleConflict,
  createAdminUserLifecycleRepository,
  type AdminUserLifecycleRepository
} from "../db/adminUserLifecycleRepository";
import { createAdminMfaRepository, isEffectiveMfa, type AdminMfaRepository } from "../db/adminMfaRepository";
import type { AdminMfaRecoveryCodeRow, AdminMfaTotpRow } from "../db/schema";
import type { Env } from "../env";
import { json, jsonError, methodNotAllowed } from "../responses";

export const CMS_AUTH_PROXY_SECRET_HEADER = "X-RCAT-CMS-Auth-Proxy-Secret";
export const CMS_SESSION_TOKEN_HEADER = "X-RCAT-CMS-Session-Token";
export const CMS_CSRF_TOKEN_HEADER = "X-RCAT-CMS-CSRF-Token";
export const CMS_CLIENT_IP_HEADER = "X-RCAT-CMS-Client-IP";
export const CMS_USER_AGENT_HEADER = "X-RCAT-CMS-User-Agent";
export const CMS_NEW_SESSION_TOKEN_HEADER = "X-RCAT-CMS-New-Session-Token";
export const CMS_NEW_CSRF_TOKEN_HEADER = "X-RCAT-CMS-New-CSRF-Token";
export const CMS_MFA_CHALLENGE_TOKEN_HEADER = "X-RCAT-CMS-MFA-Challenge-Token";
export const CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER = "X-RCAT-CMS-New-MFA-Challenge-Token";

const INTERNAL_PREFIX = "/api/internal/cms-auth/";
const LOGIN_PATH = `${INTERNAL_PREFIX}login`;
const SESSION_PATH = `${INTERNAL_PREFIX}session`;
const LOGOUT_PATH = `${INTERNAL_PREFIX}logout`;
const LOGOUT_ALL_PATH = `${INTERNAL_PREFIX}logout-all`;
const INVITATION_INSPECT_PATH = `${INTERNAL_PREFIX}invitation/inspect`;
const INVITATION_ACCEPT_PATH = `${INTERNAL_PREFIX}invitation/accept`;
const PASSWORD_RESET_INSPECT_PATH = `${INTERNAL_PREFIX}password-reset/inspect`;
const PASSWORD_RESET_COMPLETE_PATH = `${INTERNAL_PREFIX}password-reset/complete`;
const CHANGE_PASSWORD_PATH = `${INTERNAL_PREFIX}change-password`;
const MFA_VERIFY_PATH = `${INTERNAL_PREFIX}mfa/verify`;
const MFA_SETUP_START_PATH = `${INTERNAL_PREFIX}mfa/setup/start`;
const MFA_SETUP_CONFIRM_PATH = `${INTERNAL_PREFIX}mfa/setup/confirm`;
const MFA_RECOVERY_REGENERATE_PATH = `${INTERNAL_PREFIX}mfa/recovery-codes/regenerate`;
const MFA_DISABLE_PATH = `${INTERNAL_PREFIX}mfa`;
const REAUTHENTICATE_PATH = `${INTERNAL_PREFIX}reauthenticate`;
const INTERNAL_PATHS = new Set([
  LOGIN_PATH,
  SESSION_PATH,
  LOGOUT_PATH,
  LOGOUT_ALL_PATH,
  INVITATION_INSPECT_PATH,
  INVITATION_ACCEPT_PATH,
  PASSWORD_RESET_INSPECT_PATH,
  PASSWORD_RESET_COMPLETE_PATH,
  CHANGE_PASSWORD_PATH,
  MFA_VERIFY_PATH,
  MFA_SETUP_START_PATH,
  MFA_SETUP_CONFIRM_PATH,
  MFA_RECOVERY_REGENERATE_PATH,
  MFA_DISABLE_PATH,
  REAUTHENTICATE_PATH
]);
const MAX_AUTH_BODY_BYTES = 16 * 1024;

type VerifyCredential = (input: VerifyCmsCredentialInput) => ReturnType<typeof verifyCmsCredential>;
type CreateSession = (input: CreateCmsSessionInput) => ReturnType<typeof createCmsSession>;
type AuthenticateSession = (input: AuthenticateCmsSessionInput) => ReturnType<typeof authenticateCmsSession>;

export interface CmsAuthInternalDependencies {
  verifyCredential?: VerifyCredential;
  createSession?: CreateSession;
  authenticateSession?: AuthenticateSession;
  revokeSession?: AuthenticateSession;
  revokeAllSessions?: AuthenticateSession;
  lifecycleRepository?: AdminUserLifecycleRepository;
  hashPassword?: (password: string) => Promise<string>;
  verifyPassword?: (password: string, storedHash: string, algorithm: string) => Promise<boolean>;
  now?: () => Date;
  mfaRepository?: AdminMfaRepository;
}

function noStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function internalError(message: string, status: number) {
  return noStore(jsonError(message, status, { resource: "cms-auth" }));
}

function internalMethodNotAllowed(allow: string) {
  const response = methodNotAllowed();
  response.headers.set("Allow", allow);
  return noStore(response);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readBoundedAuthBody(request: Request) {
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_BODY_BYTES) {
    return { status: "too-large" as const };
  }

  let bytes: ArrayBuffer;

  try {
    bytes = await request.arrayBuffer();
  } catch {
    return { status: "malformed" as const };
  }

  if (bytes.byteLength > MAX_AUTH_BODY_BYTES) {
    return { status: "too-large" as const };
  }

  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(value) ? { status: "valid" as const, value } : { status: "malformed" as const };
  } catch {
    return { status: "malformed" as const };
  }
}

function normalizeLifecycleUsername(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9._-]{3,64}$/.test(normalized) ? normalized : null;
}

function invitationInvalid() {
  return internalError("invitation is invalid or expired", 400);
}

function passwordResetInvalid() {
  return internalError("password-reset link is invalid or expired", 400);
}

function validateNewPasswordBody(body: Record<string, unknown>): { error: Response } | { password: string } {
  if (typeof body.password !== "string" || typeof body.passwordConfirmation !== "string") {
    return { error: internalError("password and password confirmation are required", 400) };
  }

  if (body.password !== body.passwordConfirmation) {
    return { error: internalError("password confirmation does not match", 400) };
  }

  const policy = validateCmsPassword(body.password);

  if (!policy.valid) {
    return {
      error: noStore(jsonError("password policy validation failed", 400, { resource: "cms-auth", code: policy.code }))
    };
  }

  return { password: body.password };
}

function maskEmail(email: string) {
  const separator = email.lastIndexOf("@");

  if (separator <= 0) {
    return "***";
  }

  return `${email[0]}***${email.slice(separator)}`;
}

async function handleInvitationLifecycle(
  request: Request,
  env: Env,
  pathname: string,
  now: Date,
  dependencies: CmsAuthInternalDependencies
): Promise<Response> {
  if (request.method !== "POST") {
    return internalMethodNotAllowed("POST");
  }

  const body = await readBoundedAuthBody(request);

  if (body.status === "too-large") {
    return internalError("request body is too large", 413);
  }

  if (body.status !== "valid" || !isValidLifecycleToken(body.value.token)) {
    return invitationInvalid();
  }

  const repository = dependencies.lifecycleRepository ?? createAdminUserLifecycleRepository(env);
  const tokenHash = await hashInvitationToken(body.value.token);
  const inspection = await repository.inspectInvitationByTokenHash(tokenHash, now.toISOString());

  if (!inspection) {
    return invitationInvalid();
  }

  if (pathname === INVITATION_INSPECT_PATH) {
    return noStore(
      json({
        valid: true,
        user: {
          email: inspection.email,
          name: inspection.name,
          role: inspection.role,
          username: inspection.username
        },
        expiresAt: inspection.expiresAt
      })
    );
  }

  const passwordResult = validateNewPasswordBody(body.value);

  if ("error" in passwordResult) {
    return passwordResult.error;
  }

  const usernameProvided = Object.prototype.hasOwnProperty.call(body.value, "username");
  const username = usernameProvided ? normalizeLifecycleUsername(body.value.username) : null;

  if (usernameProvided && !username) {
    return internalError("username is invalid", 400);
  }

  if (inspection.username && username && inspection.username.toLowerCase() !== username) {
    return internalError("preassigned username cannot be replaced", 409);
  }

  const effectiveUsername = inspection.username ?? username;

  if (effectiveUsername && !(await repository.isUsernameAvailable(effectiveUsername, inspection.userId))) {
    return internalError("username is already in use", 409);
  }

  const hashPassword = dependencies.hashPassword ?? hashCmsPassword;
  const passwordHash = await hashPassword(passwordResult.password);

  try {
    await repository.acceptInvitation({
      invitationId: inspection.invitationId,
      userId: inspection.userId,
      tokenHash,
      passwordHash,
      passwordAlgorithm: CMS_PASSWORD_ALGORITHM,
      username: effectiveUsername,
      expectedUsername: inspection.username,
      actor: "cms-invitation",
      now: now.toISOString()
    });
  } catch (error) {
    if (error instanceof AdminUserLifecycleConflict) {
      return error.code === "duplicate_username"
        ? internalError("username is already in use", 409)
        : invitationInvalid();
    }

    throw error;
  }

  return noStore(json({ ok: true, credentialConfigured: true }));
}

async function handlePasswordResetLifecycle(
  request: Request,
  env: Env,
  pathname: string,
  now: Date,
  dependencies: CmsAuthInternalDependencies
): Promise<Response> {
  if (request.method !== "POST") {
    return internalMethodNotAllowed("POST");
  }

  const body = await readBoundedAuthBody(request);

  if (body.status === "too-large") {
    return internalError("request body is too large", 413);
  }

  if (body.status !== "valid" || !isValidLifecycleToken(body.value.token)) {
    return passwordResetInvalid();
  }

  const repository = dependencies.lifecycleRepository ?? createAdminUserLifecycleRepository(env);
  const tokenHash = await hashPasswordResetToken(body.value.token);
  const inspection = await repository.inspectPasswordResetByTokenHash(tokenHash, now.toISOString());

  if (!inspection) {
    return passwordResetInvalid();
  }

  if (pathname === PASSWORD_RESET_INSPECT_PATH) {
    return noStore(
      json({ valid: true, user: { emailHint: maskEmail(inspection.email) }, expiresAt: inspection.expiresAt })
    );
  }

  const passwordResult = validateNewPasswordBody(body.value);

  if ("error" in passwordResult) {
    return passwordResult.error;
  }

  const hashPassword = dependencies.hashPassword ?? hashCmsPassword;
  const passwordHash = await hashPassword(passwordResult.password);

  try {
    await repository.completePasswordReset({
      resetTokenId: inspection.resetTokenId,
      userId: inspection.userId,
      tokenHash,
      passwordHash,
      passwordAlgorithm: CMS_PASSWORD_ALGORITHM,
      actor: "cms-password-reset",
      now: now.toISOString()
    });
  } catch (error) {
    if (error instanceof AdminUserLifecycleConflict) {
      return passwordResetInvalid();
    }

    throw error;
  }

  return noStore(json({ ok: true, passwordReset: true }));
}

async function handlePasswordChange(
  request: Request,
  env: Env,
  now: Date,
  dependencies: CmsAuthInternalDependencies
): Promise<Response> {
  if (request.method !== "POST") {
    return internalMethodNotAllowed("POST");
  }

  const body = await readBoundedAuthBody(request);

  if (body.status === "too-large") {
    return internalError("request body is too large", 413);
  }

  if (body.status !== "valid" || typeof body.value.currentPassword !== "string" || !body.value.currentPassword) {
    return internalError("current password is required", 400);
  }

  const authenticateSession = dependencies.authenticateSession ?? authenticateCmsSession;
  const session = await authenticateSession(getSessionInput(request, env, now));

  if (session.status !== "authenticated") {
    return sessionFailure(session.status);
  }

  if (!hasAdminCapability(session.identity.role, "auth.change-password-self")) {
    return internalError("required permission is missing", 403);
  }

  const passwordResult = validateNewPasswordBody(body.value);

  if ("error" in passwordResult) {
    return passwordResult.error;
  }

  const repository = dependencies.lifecycleRepository ?? createAdminUserLifecycleRepository(env);
  const credential = await repository.getCredentialByUserId(session.identity.id);
  const verifyPassword = dependencies.verifyPassword ?? verifyCmsPassword;

  if (
    !credential ||
    !(await verifyPassword(body.value.currentPassword, credential.password_hash, credential.password_algorithm))
  ) {
    return internalError("current password is invalid", 401);
  }

  if (await verifyPassword(passwordResult.password, credential.password_hash, credential.password_algorithm)) {
    return internalError("new password must differ from current password", 400);
  }

  const hashPassword = dependencies.hashPassword ?? hashCmsPassword;
  const passwordHash = await hashPassword(passwordResult.password);

  try {
    await repository.changeUserPassword({
      userId: session.identity.id,
      expectedPasswordHash: credential.password_hash,
      passwordHash,
      passwordAlgorithm: CMS_PASSWORD_ALGORITHM,
      actor: session.identity.email,
      now: now.toISOString()
    });
  } catch (error) {
    if (error instanceof AdminUserLifecycleConflict) {
      return internalError("current password is invalid", 401);
    }

    throw error;
  }

  return noStore(json({ ok: true, passwordChanged: true }));
}

function readMetadataHeader(request: Request, name: string, maximumLength: number) {
  const value = request.headers.get(name) ?? "";
  const hasControlCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });

  if (!value || value.length > maximumLength || hasControlCharacter) {
    return "unknown";
  }

  return value;
}

function getSessionInput(request: Request, env: Env, now: Date): AuthenticateCmsSessionInput {
  return {
    env,
    sessionToken: request.headers.get(CMS_SESSION_TOKEN_HEADER) ?? "",
    csrfToken: request.headers.get(CMS_CSRF_TOKEN_HEADER) ?? undefined,
    method: request.method,
    now
  };
}

function sessionFailure(status: "forbidden" | "unauthenticated" | "unavailable") {
  if (status === "forbidden") {
    return internalError("CSRF validation failed", 403);
  }

  if (status === "unavailable") {
    return internalError("CMS authentication is unavailable", 503);
  }

  return internalError("CMS session is invalid or expired", 401);
}

function metadata(request: Request) {
  return {
    clientIp: readMetadataHeader(request, CMS_CLIENT_IP_HEADER, 64),
    userAgent: readMetadataHeader(request, CMS_USER_AGENT_HEADER, 512)
  };
}

function credentialIdentity(user: {
  id: string;
  email: string;
  name: string;
  username: string | null;
  role: "admin" | "editor" | "viewer";
  is_root: 0 | 1;
  must_change_password: 0 | 1;
  mfa_required: 0 | 1;
  session_version: number;
}) {
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

function adminSessionIdentity(identity: Awaited<ReturnType<typeof authenticateCmsSession>> & object) {
  if (!("identity" in identity)) return null;
  const session = identity.identity;
  return {
    actor: session.email,
    email: session.email,
    mode: "cms-session" as const,
    role: session.role,
    userId: session.id,
    sessionId: session.sessionId,
    isRoot: session.isRoot,
    reauthenticatedAt: session.reauthenticatedAt,
    mfaVerifiedAt: session.mfaVerifiedAt
  };
}

async function authenticateMfaSession(
  request: Request,
  env: Env,
  now: Date,
  dependencies: CmsAuthInternalDependencies
) {
  const authenticateSession = dependencies.authenticateSession ?? authenticateCmsSession;
  const result = await authenticateSession(getSessionInput(request, env, now));
  return result.status === "authenticated" ? result : sessionFailure(result.status);
}

async function readMfaBody(request: Request) {
  const body = await readBoundedAuthBody(request);
  if (body.status === "too-large") return { error: internalError("request body is too large", 413) } as const;
  if (body.status !== "valid") return { error: internalError("invalid MFA request", 400) } as const;
  return { value: body.value } as const;
}

function mfaVerificationFailed() {
  return internalError("MFA verification failed", 401);
}

async function handleMfaVerify(request: Request, env: Env, now: Date, dependencies: CmsAuthInternalDependencies) {
  if (request.method !== "POST") return internalMethodNotAllowed("POST");
  const challengeToken = request.headers.get(CMS_MFA_CHALLENGE_TOKEN_HEADER) ?? "";
  if (!isValidMfaChallengeToken(challengeToken)) return mfaVerificationFailed();
  const body = await readMfaBody(request);
  if ("error" in body) return body.error!;
  const repository = dependencies.mfaRepository ?? createAdminMfaRepository(env);
  const client = metadata(request);
  const record = await validateCmsMfaChallenge({
    env,
    token: challengeToken,
    purpose: "login",
    ...client,
    now,
    repository,
    recordFailure: true
  });
  if (!record || !record.factor || record.factor.state !== "enabled") return mfaVerificationFailed();
  const proof = await resolveMfaFactorProof({
    env,
    record,
    totpCode: body.value.totpCode,
    recoveryCode: body.value.recoveryCode,
    now,
    repository
  });
  if (!proof) {
    await repository.recordChallengeFailure(record.challenge.id, now.toISOString());
    return mfaVerificationFailed();
  }
  const prepared = await prepareCmsSession({
    env,
    identity: credentialIdentity(record.user),
    ...client,
    now,
    mfaVerified: true
  });
  try {
    await repository.completeLoginChallenge({
      challenge: record.challenge,
      proof,
      session: prepared.session,
      actor: record.user.email,
      now: now.toISOString()
    });
  } catch {
    await repository.recordChallengeFailure(record.challenge.id, now.toISOString()).catch(() => undefined);
    return mfaVerificationFailed();
  }
  const response = noStore(json({ ok: true, user: prepared.identity }));
  response.headers.set(CMS_NEW_SESSION_TOKEN_HEADER, prepared.sessionToken);
  response.headers.set(CMS_NEW_CSRF_TOKEN_HEADER, prepared.csrfToken);
  return response;
}

async function getEnrollmentContext(request: Request, env: Env, now: Date, dependencies: CmsAuthInternalDependencies) {
  const repository = dependencies.mfaRepository ?? createAdminMfaRepository(env);
  const challengeToken = request.headers.get(CMS_MFA_CHALLENGE_TOKEN_HEADER) ?? "";

  if (challengeToken) {
    if (!isValidMfaChallengeToken(challengeToken)) return { error: mfaVerificationFailed() } as const;
    const record = await validateCmsMfaChallenge({
      env,
      token: challengeToken,
      purpose: "enrollment",
      ...metadata(request),
      now,
      repository,
      recordFailure: true
    });
    return record ? { mode: "challenge" as const, record, repository } : ({ error: mfaVerificationFailed() } as const);
  }

  const result = await authenticateMfaSession(request, env, now, dependencies);
  if (result instanceof Response) return { error: result } as const;
  const identity = adminSessionIdentity(result);
  if (
    !identity ||
    !hasAdminCapability(identity, "auth.mfa.manage-self") ||
    !hasRecentAdminAssurance(identity, "password", now)
  ) {
    return { error: internalError("recent password reauthentication is required", 428) } as const;
  }
  const state = await repository.getUserState(result.identity.id);
  return state
    ? { mode: "session" as const, result, state, repository }
    : ({ error: internalError("CMS authentication is unavailable", 503) } as const);
}

async function handleMfaSetupStart(request: Request, env: Env, now: Date, dependencies: CmsAuthInternalDependencies) {
  if (request.method !== "POST") return internalMethodNotAllowed("POST");
  const context = await getEnrollmentContext(request, env, now, dependencies);
  if ("error" in context) return context.error!;
  const user = context.mode === "challenge" ? context.record.user : context.state.user;
  const factor = context.mode === "challenge" ? context.record.factor : context.state.factor;
  if (factor?.state === "enabled") return internalError("MFA is already configured", 409);
  const secret = generateTotpSecret();
  const encrypted = await encryptTotpSecret({
    secret,
    userId: user.id,
    encryptionKey: env.CMS_MFA_ENCRYPTION_KEY,
    keyVersion: env.CMS_MFA_ENCRYPTION_KEY_VERSION
  });
  const createdAt = now.toISOString();
  const pending: AdminMfaTotpRow = {
    user_id: user.id,
    encrypted_secret: encrypted.encryptedSecret,
    iv: encrypted.iv,
    key_version: encrypted.keyVersion,
    state: "pending",
    created_at: createdAt,
    enabled_at: "",
    updated_at: createdAt,
    last_used_step: -1
  };
  await context.repository.replacePendingFactor(pending, user.email, createdAt);
  const expiresAt =
    context.mode === "challenge"
      ? context.record.challenge.expires_at
      : new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  return noStore(json({ manualEntryKey: secret, otpAuthUri: createTotpUri(secret, user.email), expiresAt }));
}

async function createRecoveryCodeRows(userId: string, codes: string[], now: string) {
  return Promise.all(
    codes.map(async (code): Promise<AdminMfaRecoveryCodeRow> => ({
      id: `admin-mfa-recovery-${crypto.randomUUID()}`,
      user_id: userId,
      code_hash: await hashRecoveryCode(code),
      created_at: now,
      used_at: ""
    }))
  );
}

async function handleMfaSetupConfirm(request: Request, env: Env, now: Date, dependencies: CmsAuthInternalDependencies) {
  if (request.method !== "POST") return internalMethodNotAllowed("POST");
  const body = await readMfaBody(request);
  if ("error" in body) return body.error!;
  const context = await getEnrollmentContext(request, env, now, dependencies);
  if ("error" in context) return context.error!;
  const user = context.mode === "challenge" ? context.record.user : context.state.user;
  const factor = context.mode === "challenge" ? context.record.factor : context.state.factor;
  if (!factor || factor.state !== "pending" || now.getTime() >= Date.parse(factor.updated_at) + 10 * 60 * 1000) {
    return mfaVerificationFailed();
  }
  let secret: string;
  try {
    secret = await decryptTotpSecret({
      encryptedSecret: factor.encrypted_secret,
      iv: factor.iv,
      userId: user.id,
      storedKeyVersion: factor.key_version,
      encryptionKey: env.CMS_MFA_ENCRYPTION_KEY,
      configuredKeyVersion: env.CMS_MFA_ENCRYPTION_KEY_VERSION
    });
  } catch {
    return internalError("CMS authentication is unavailable", 503);
  }
  const verified = await verifyTotpCode(body.value.totpCode, secret, now.getTime());
  if (!verified || verified.matchedStep <= factor.last_used_step) {
    if (context.mode === "challenge") {
      await context.repository.recordChallengeFailure(context.record.challenge.id, now.toISOString());
    }
    return mfaVerificationFailed();
  }
  const recoveryCodes = generateRecoveryCodes();
  const rows = await createRecoveryCodeRows(user.id, recoveryCodes, now.toISOString());
  let prepared: Awaited<ReturnType<typeof prepareCmsSession>> | undefined;
  if (context.mode === "challenge") {
    prepared = await prepareCmsSession({
      env,
      identity: credentialIdentity(user),
      ...metadata(request),
      now,
      mfaVerified: true
    });
  }
  await context.repository.confirmEnrollment({
    challengeId: context.mode === "challenge" ? context.record.challenge.id : undefined,
    factor,
    expectedSessionVersion: user.session_version,
    matchedStep: verified.matchedStep,
    recoveryCodes: rows,
    session: prepared?.session,
    actor: user.email,
    now: now.toISOString()
  });
  const response = noStore(json({ ok: true, recoveryCodes, loginRequired: context.mode === "session" }));
  if (prepared) {
    response.headers.set(CMS_NEW_SESSION_TOKEN_HEADER, prepared.sessionToken);
    response.headers.set(CMS_NEW_CSRF_TOKEN_HEADER, prepared.csrfToken);
  }
  return response;
}

async function handleRecoveryRegenerate(
  request: Request,
  env: Env,
  now: Date,
  dependencies: CmsAuthInternalDependencies
) {
  if (request.method !== "POST") return internalMethodNotAllowed("POST");
  const result = await authenticateMfaSession(request, env, now, dependencies);
  if (result instanceof Response) return result;
  const identity = adminSessionIdentity(result);
  if (
    !identity ||
    !hasAdminCapability(identity, "auth.mfa.manage-self") ||
    !hasRecentAdminAssurance(identity, "mfa", now)
  )
    return internalError("recent MFA reauthentication is required", 428);
  const repository = dependencies.mfaRepository ?? createAdminMfaRepository(env);
  const state = await repository.getUserState(result.identity.id);
  if (!state?.factor || state.factor.state !== "enabled") return internalError("MFA is not configured", 409);
  const recoveryCodes = generateRecoveryCodes();
  await repository.regenerateRecoveryCodes({
    userId: state.user.id,
    recoveryCodes: await createRecoveryCodeRows(state.user.id, recoveryCodes, now.toISOString()),
    actor: state.user.email,
    now: now.toISOString()
  });
  return noStore(json({ ok: true, recoveryCodes }));
}

async function verifyCurrentPassword(
  body: Record<string, unknown>,
  userId: string,
  env: Env,
  dependencies: CmsAuthInternalDependencies
) {
  if (typeof body.currentPassword !== "string" || !body.currentPassword) return false;
  const lifecycle = dependencies.lifecycleRepository ?? createAdminUserLifecycleRepository(env);
  const credential = await lifecycle.getCredentialByUserId(userId);
  const verifyPassword = dependencies.verifyPassword ?? verifyCmsPassword;
  return Boolean(
    credential && (await verifyPassword(body.currentPassword, credential.password_hash, credential.password_algorithm))
  );
}

async function handleReauthenticate(request: Request, env: Env, now: Date, dependencies: CmsAuthInternalDependencies) {
  if (request.method !== "POST") return internalMethodNotAllowed("POST");
  const body = await readMfaBody(request);
  if ("error" in body) return body.error!;
  const result = await authenticateMfaSession(request, env, now, dependencies);
  if (result instanceof Response) return result;
  const identity = adminSessionIdentity(result);
  if (!identity || !hasAdminCapability(identity, "auth.reauthenticate-self")) {
    return internalError("required permission is missing", 403);
  }
  if (!(await verifyCurrentPassword(body.value, result.identity.id, env, dependencies))) {
    return internalError("reauthentication failed", 401);
  }
  const repository = dependencies.mfaRepository ?? createAdminMfaRepository(env);
  const state = await repository.getUserState(result.identity.id);
  if (!state) return internalError("CMS authentication is unavailable", 503);
  let proof;
  if (isEffectiveMfa(state.user, state.factor)) {
    proof = await resolveMfaFactorProof({
      env,
      record: state,
      totpCode: body.value.totpCode,
      recoveryCode: body.value.recoveryCode,
      now,
      repository
    });
    if (!proof) return internalError("reauthentication failed", 401);
  } else if (body.value.totpCode !== undefined || body.value.recoveryCode !== undefined) {
    return internalError("reauthentication failed", 401);
  }
  try {
    await repository.reauthenticateSession({
      sessionId: result.identity.sessionId,
      userId: result.identity.id,
      proof,
      actor: result.identity.email,
      now: now.toISOString()
    });
  } catch {
    return internalError("reauthentication failed", 401);
  }
  return noStore(json({ ok: true, reauthenticated: true, mfaVerified: Boolean(proof) }));
}

async function handleMfaDisable(request: Request, env: Env, now: Date, dependencies: CmsAuthInternalDependencies) {
  if (request.method !== "DELETE") return internalMethodNotAllowed("DELETE");
  const body = await readMfaBody(request);
  if ("error" in body) return body.error!;
  const result = await authenticateMfaSession(request, env, now, dependencies);
  if (result instanceof Response) return result;
  const identity = adminSessionIdentity(result);
  if (
    !identity ||
    !hasAdminCapability(identity, "auth.mfa.manage-self") ||
    !hasRecentAdminAssurance(identity, "mfa", now)
  )
    return internalError("recent MFA reauthentication is required", 428);
  const repository = dependencies.mfaRepository ?? createAdminMfaRepository(env);
  const state = await repository.getUserState(result.identity.id);
  if (!state?.factor || state.factor.state !== "enabled") return internalError("MFA is not configured", 409);
  if (state.user.is_root === 1 || state.user.mfa_required === 1) {
    return internalError("MFA is required for this account", 409);
  }
  if (!(await verifyCurrentPassword(body.value, result.identity.id, env, dependencies))) {
    return internalError("MFA disable verification failed", 401);
  }
  const proof = await resolveMfaFactorProof({
    env,
    record: state,
    totpCode: body.value.totpCode,
    recoveryCode: body.value.recoveryCode,
    now,
    repository
  });
  if (!proof) return internalError("MFA disable verification failed", 401);
  await repository.disableOwnMfa({ userId: state.user.id, actor: state.user.email, now: now.toISOString() });
  return noStore(json({ ok: true, disabled: true }));
}

async function authorizeInternalRequest(request: Request, env: Env) {
  if (env.CMS_AUTH_ENABLED !== "true") {
    return internalError("not found", 404);
  }

  const configuredSecret = env.CMS_AUTH_PROXY_SECRET ?? "";

  if (configuredSecret.length < 32) {
    return internalError("CMS authentication is unavailable", 503);
  }

  if (request.headers.has("Origin")) {
    return internalError("browser-origin request is not allowed", 403);
  }

  const providedSecret = request.headers.get(CMS_AUTH_PROXY_SECRET_HEADER) ?? "";

  if (!(await constantTimeTextEqual(providedSecret, configuredSecret))) {
    return internalError("internal authentication failed", 403);
  }

  return null;
}

export async function handleCmsAuthInternal(
  request: Request,
  env: Env,
  dependencies: CmsAuthInternalDependencies = {}
): Promise<Response | null> {
  const { pathname } = new URL(request.url);

  if (!pathname.startsWith(INTERNAL_PREFIX)) {
    return null;
  }

  if (!INTERNAL_PATHS.has(pathname)) {
    return internalError("not found", 404);
  }

  const authorizationError = await authorizeInternalRequest(request, env);

  if (authorizationError) {
    return authorizationError;
  }

  const now = dependencies.now?.() ?? new Date();

  if (pathname === INVITATION_INSPECT_PATH || pathname === INVITATION_ACCEPT_PATH) {
    try {
      return await handleInvitationLifecycle(request, env, pathname, now, dependencies);
    } catch {
      return internalError("CMS authentication is unavailable", 503);
    }
  }

  if (pathname === PASSWORD_RESET_INSPECT_PATH || pathname === PASSWORD_RESET_COMPLETE_PATH) {
    try {
      return await handlePasswordResetLifecycle(request, env, pathname, now, dependencies);
    } catch {
      return internalError("CMS authentication is unavailable", 503);
    }
  }

  if (pathname === CHANGE_PASSWORD_PATH) {
    try {
      return await handlePasswordChange(request, env, now, dependencies);
    } catch {
      return internalError("CMS authentication is unavailable", 503);
    }
  }

  try {
    if (pathname === MFA_VERIFY_PATH) {
      return await handleMfaVerify(request, env, now, dependencies);
    }
    if (pathname === MFA_SETUP_START_PATH) {
      return await handleMfaSetupStart(request, env, now, dependencies);
    }
    if (pathname === MFA_SETUP_CONFIRM_PATH) {
      return await handleMfaSetupConfirm(request, env, now, dependencies);
    }
    if (pathname === MFA_RECOVERY_REGENERATE_PATH) {
      return await handleRecoveryRegenerate(request, env, now, dependencies);
    }
    if (pathname === MFA_DISABLE_PATH) {
      return await handleMfaDisable(request, env, now, dependencies);
    }
    if (pathname === REAUTHENTICATE_PATH) {
      return await handleReauthenticate(request, env, now, dependencies);
    }
  } catch {
    return internalError("CMS authentication is unavailable", 503);
  }

  if (pathname === LOGIN_PATH) {
    if (request.method !== "POST") {
      return internalMethodNotAllowed("POST");
    }

    const body = await readBoundedAuthBody(request);

    if (body.status === "too-large") {
      return internalError("request body is too large", 413);
    }

    if (
      body.status !== "valid" ||
      typeof body.value.identifier !== "string" ||
      typeof body.value.password !== "string"
    ) {
      return internalError("invalid login request", 400);
    }

    const verifyCredential = dependencies.verifyCredential ?? verifyCmsCredential;
    const credential = await verifyCredential({
      env,
      identifier: body.value.identifier,
      password: body.value.password,
      now
    });

    if (credential.status === "unavailable") {
      return internalError("CMS authentication is unavailable", 503);
    }

    if (credential.status !== "success") {
      return internalError("invalid identifier or password", 401);
    }

    try {
      const mfaRepository = dependencies.mfaRepository ?? createAdminMfaRepository(env);
      const mfaState = await mfaRepository.getUserState(credential.identity.id);

      if (!mfaState) {
        return internalError("CMS authentication is unavailable", 503);
      }

      if (isEffectiveMfa(mfaState.user, mfaState.factor)) {
        const enrollmentRequired = mfaState.factor?.state !== "enabled";
        const createdChallenge = await createCmsMfaChallenge({
          env,
          identity: credential.identity,
          purpose: enrollmentRequired ? "enrollment" : "login",
          ...metadata(request),
          now,
          repository: mfaRepository
        });
        const response = noStore(
          json(
            {
              mfaRequired: true,
              enrollmentRequired
            },
            { status: 202 }
          )
        );
        response.headers.set(CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER, createdChallenge.token);
        return response;
      }

      const createSession = dependencies.createSession ?? createCmsSession;
      const created = await createSession({
        env,
        identity: credential.identity,
        clientIp: readMetadataHeader(request, CMS_CLIENT_IP_HEADER, 64),
        userAgent: readMetadataHeader(request, CMS_USER_AGENT_HEADER, 512),
        now
      });
      const response = noStore(json({ ok: true, user: created.identity }));
      response.headers.set(CMS_NEW_SESSION_TOKEN_HEADER, created.sessionToken);
      response.headers.set(CMS_NEW_CSRF_TOKEN_HEADER, created.csrfToken);
      return response;
    } catch (error) {
      if (error instanceof CmsSessionEligibilityError) {
        return internalError("CMS session is unavailable", 403);
      }

      return internalError("CMS authentication is unavailable", 503);
    }
  }

  if (pathname === SESSION_PATH) {
    if (request.method !== "GET") {
      return internalMethodNotAllowed("GET");
    }

    const authenticateSession = dependencies.authenticateSession ?? authenticateCmsSession;
    const result = await authenticateSession(getSessionInput(request, env, now));

    return result.status === "authenticated"
      ? noStore(json({ ok: true, user: result.identity }))
      : sessionFailure(result.status);
  }

  if (request.method !== "POST") {
    return internalMethodNotAllowed("POST");
  }

  const rawSessionToken = request.headers.get(CMS_SESSION_TOKEN_HEADER) ?? "";
  const rawCsrfToken = request.headers.get(CMS_CSRF_TOKEN_HEADER) ?? "";

  if (!isValidCmsToken(rawSessionToken)) {
    return internalError("CMS session is invalid or expired", 401);
  }

  if (!isValidCmsToken(rawCsrfToken)) {
    return internalError("CSRF validation failed", 403);
  }

  const operation =
    pathname === LOGOUT_PATH
      ? (dependencies.revokeSession ?? revokeCmsSession)
      : (dependencies.revokeAllSessions ?? revokeAllCmsSessions);
  const result = await operation(getSessionInput(request, env, now));

  return result.status === "authenticated" ? noStore(json({ ok: true })) : sessionFailure(result.status);
}
