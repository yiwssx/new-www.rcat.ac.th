import type { AdminIdentity } from "../auth/adminAccess";
import { CMS_PASSWORD_ALGORITHM, hashCmsPassword, validateCmsPassword } from "../auth/cmsPassword";
import {
  AdminAuthRepositoryConflict,
  createAdminAuthRepository,
  type AdminAuthRepository
} from "../db/adminAuthRepository";
import type { Env } from "../env";
import { json, jsonError, methodNotAllowed } from "../responses";

type JsonRecord = Record<string, unknown>;

export interface AdminAuthRouteDependencies {
  repository?: AdminAuthRepository;
  hashPassword?: (password: string) => Promise<string>;
  now?: () => Date;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readRequestBody(request: Request) {
  try {
    const body: unknown = await request.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

function normalizeUsername(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toLowerCase();
  return /^[a-z0-9._-]{3,64}$/.test(normalized) ? normalized : null;
}

function safeError(message: string, status: number, extra: JsonRecord = {}) {
  return jsonError(message, status, { resource: "admin-auth", ...extra });
}

function adminAuthMethodNotAllowed() {
  const response = methodNotAllowed();
  response.headers.set("Allow", "POST");
  return response;
}

export async function handleAdminAuth(
  request: Request,
  env: Env,
  segments: string[],
  identity: AdminIdentity,
  dependencies: AdminAuthRouteDependencies = {}
): Promise<Response | null> {
  if (segments[0] !== "auth") {
    return null;
  }

  if (segments.length !== 2 || segments[1] !== "bootstrap-root-credential") {
    return safeError("not found", 404);
  }

  if (request.method !== "POST") {
    return adminAuthMethodNotAllowed();
  }

  const repository = dependencies.repository ?? createAdminAuthRepository(env);
  const roots = await repository.getProtectedRootAccounts();

  if (roots.length !== 1) {
    return safeError("root credential bootstrap is unavailable", 409);
  }

  const root = roots[0];

  if (root.is_root !== 1 || root.role !== "admin" || root.status !== "active") {
    return safeError("root credential bootstrap is unavailable", 409);
  }

  if (identity.email.trim().toLowerCase() !== root.email.trim().toLowerCase()) {
    return safeError("root identity is required", 403);
  }

  if (await repository.rootHasCredential(root.id)) {
    return safeError("root credential is already configured", 409);
  }

  const body = await readRequestBody(request);

  if (!body) {
    return safeError("request body must be a JSON object", 400);
  }

  if (typeof body.password !== "string" || typeof body.passwordConfirmation !== "string") {
    return safeError("password and password confirmation are required", 400);
  }

  if (body.password !== body.passwordConfirmation) {
    return safeError("password confirmation does not match", 400, { code: "confirmation_mismatch" });
  }

  const policyResult = validateCmsPassword(body.password);

  if (!policyResult.valid) {
    return safeError("password policy validation failed", 400, { code: policyResult.code });
  }

  const updateUsername = Object.prototype.hasOwnProperty.call(body, "username");
  const username = updateUsername ? normalizeUsername(body.username) : null;

  if (updateUsername && !username) {
    return safeError("username is invalid", 400, { field: "username" });
  }

  if (username) {
    const usernameMatches = await repository.findAuthenticationUsersByUsername(username);

    if (usernameMatches.some((user) => user.id !== root.id) || usernameMatches.length > 1) {
      return safeError("username is already in use", 409, { field: "username" });
    }
  }

  const hashPassword = dependencies.hashPassword ?? hashCmsPassword;
  const now = dependencies.now?.() ?? new Date();
  const passwordHash = await hashPassword(body.password);

  try {
    await repository.createInitialRootCredential({
      rootUserId: root.id,
      passwordHash,
      passwordAlgorithm: CMS_PASSWORD_ALGORITHM,
      username,
      updateUsername,
      actor: identity.actor,
      now
    });
  } catch (error) {
    if (error instanceof AdminAuthRepositoryConflict) {
      if (error.code === "credential_configured") {
        return safeError("root credential is already configured", 409);
      }

      if (error.code === "duplicate_username") {
        return safeError("username is already in use", 409, { field: "username" });
      }

      return safeError("root credential bootstrap is unavailable", 409);
    }

    throw error;
  }

  return json({
    ok: true,
    credentialConfigured: true,
    user: {
      id: root.id,
      email: root.email,
      username: updateUsername ? username : root.username,
      isRoot: true
    }
  });
}
