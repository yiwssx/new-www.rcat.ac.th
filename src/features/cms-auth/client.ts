import { buildCloudflareAdminApiUrl } from "../../config/adminWriteProvider";
import { CMS_AUTH_PATHS, CMS_CSRF_HEADER_NAME } from "./constants";
import { parseCmsCapabilityPayload, type CmsCapabilityPayload } from "./capabilities";
import { readCmsCsrfToken } from "./cookie";
import { CmsAuthError } from "./errors";
import {
  isCmsRole,
  isRecord,
  parseCmsSafeUser,
  type CmsAssurance,
  type CmsInvitationInspection,
  type CmsLoginResult,
  type CmsMfaProof,
  type CmsMfaSetup,
  type CmsPasswordResetInspection,
  type CmsRecoveryCodesResult,
  type CmsSafeUser
} from "./types";

type JsonObject = Record<string, unknown>;
type CmsMfaMode = "challenge" | "session";

interface CmsRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: JsonObject;
  csrf?: boolean;
}

function isAssurance(value: unknown): value is CmsAssurance {
  return value === "password" || value === "mfa";
}

function positiveInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function throwCmsError(response: Response, payload: unknown): Promise<never> {
  const body = isRecord(payload) ? payload : {};
  throw new CmsAuthError(response.status, {
    retryAfterSeconds: positiveInteger(body.retryAfterSeconds),
    assurance: isAssurance(body.assurance) ? body.assurance : undefined
  });
}

async function requestCms(path: string, options: CmsRequestOptions = {}) {
  if (!path.startsWith("/api/cms-auth/") || path.includes("://")) {
    throw new TypeError("CMS authentication path must be same-origin");
  }

  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: "application/json" });

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.csrf) {
    const csrfToken = readCmsCsrfToken();

    if (!csrfToken) {
      throw new CmsAuthError(403);
    }

    headers.set(CMS_CSRF_HEADER_NAME, csrfToken);
  }

  let response: Response;

  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw new CmsAuthError(503);
  }

  if (response.status === 204) {
    if (!response.ok) {
      await throwCmsError(response, null);
    }

    return null;
  }

  const payload = await readJson(response);

  if (!response.ok) {
    await throwCmsError(response, payload);
  }

  if (!isRecord(payload)) {
    throw new CmsAuthError(503);
  }

  return payload;
}

function parseRecoveryCodes(payload: JsonObject) {
  if (
    !Array.isArray(payload.recoveryCodes) ||
    payload.recoveryCodes.length !== 10 ||
    !payload.recoveryCodes.every((code) => typeof code === "string" && code.length > 0)
  ) {
    throw new CmsAuthError(503);
  }

  return [...payload.recoveryCodes];
}

export async function getCmsSession(): Promise<CmsSafeUser> {
  const payload = await requestCms(CMS_AUTH_PATHS.session);
  return parseCmsSafeUser(payload?.user);
}

export async function getCmsCapabilities(): Promise<CmsCapabilityPayload> {
  let response: Response;

  try {
    response = await fetch(buildCloudflareAdminApiUrl("/api/admin/capabilities"), {
      credentials: "include",
      headers: { Accept: "application/json" }
    });
  } catch {
    throw new CmsAuthError(503);
  }

  const payload = await readJson(response);

  if (!response.ok) {
    await throwCmsError(response, payload);
  }

  try {
    return parseCmsCapabilityPayload(payload);
  } catch {
    throw new CmsAuthError(503);
  }
}

export async function loginCmsAccount(identifier: string, password: string): Promise<CmsLoginResult> {
  const payload = await requestCms(CMS_AUTH_PATHS.login, {
    method: "POST",
    body: { identifier, password }
  });

  if (payload?.mfaRequired === true && typeof payload.enrollmentRequired === "boolean") {
    return {
      kind: "challenge",
      mfaRequired: true,
      enrollmentRequired: payload.enrollmentRequired
    };
  }

  if (payload?.ok === true) {
    return { kind: "authenticated", user: parseCmsSafeUser(payload.user) };
  }

  throw new CmsAuthError(503);
}

export async function verifyCmsMfa(proof: CmsMfaProof) {
  const payload = await requestCms(CMS_AUTH_PATHS.verifyMfa, { method: "POST", body: proof });

  if (payload?.ok !== true) {
    throw new CmsAuthError(503);
  }

  return parseCmsSafeUser(payload.user);
}

export async function startCmsMfaSetup(mode: CmsMfaMode): Promise<CmsMfaSetup> {
  const payload = await requestCms(CMS_AUTH_PATHS.startMfaSetup, {
    method: "POST",
    csrf: mode === "session"
  });

  if (
    typeof payload?.manualEntryKey !== "string" ||
    !payload.manualEntryKey ||
    typeof payload.otpAuthUri !== "string" ||
    !payload.otpAuthUri.startsWith("otpauth://totp/") ||
    typeof payload.expiresAt !== "string"
  ) {
    throw new CmsAuthError(503);
  }

  return {
    manualEntryKey: payload.manualEntryKey,
    otpAuthUri: payload.otpAuthUri,
    expiresAt: payload.expiresAt
  };
}

export async function confirmCmsMfaSetup(mode: CmsMfaMode, totpCode: string): Promise<CmsRecoveryCodesResult> {
  const payload = await requestCms(CMS_AUTH_PATHS.confirmMfaSetup, {
    method: "POST",
    body: { totpCode },
    csrf: mode === "session"
  });

  if (!payload) {
    throw new CmsAuthError(503);
  }

  return {
    recoveryCodes: parseRecoveryCodes(payload),
    loginRequired: payload?.loginRequired === true
  };
}

export function logoutCmsSession() {
  return requestCms(CMS_AUTH_PATHS.logout, { method: "POST", csrf: true });
}

export function logoutAllCmsSessions() {
  return requestCms(CMS_AUTH_PATHS.logoutAll, { method: "POST", csrf: true });
}

export async function reauthenticateCmsSession(input: { currentPassword: string } & Partial<CmsMfaProof>) {
  const payload = await requestCms(CMS_AUTH_PATHS.reauthenticate, {
    method: "POST",
    body: input,
    csrf: true
  });

  if (payload?.ok !== true || payload.reauthenticated !== true) {
    throw new CmsAuthError(503);
  }

  return {
    recentPasswordAuthentication: payload.recentPasswordAuthentication === true,
    recentMfaAuthentication: payload.recentMfaAuthentication === true
  };
}

export async function changeCmsPassword(currentPassword: string, password: string, passwordConfirmation: string) {
  const payload = await requestCms(CMS_AUTH_PATHS.changePassword, {
    method: "POST",
    body: { currentPassword, password, passwordConfirmation },
    csrf: true
  });

  if (payload?.ok !== true || payload.passwordChanged !== true) {
    throw new CmsAuthError(503);
  }
}

export async function regenerateCmsRecoveryCodes() {
  const payload = await requestCms(CMS_AUTH_PATHS.regenerateRecoveryCodes, { method: "POST", csrf: true });
  if (!payload) {
    throw new CmsAuthError(503);
  }
  return parseRecoveryCodes(payload);
}

export async function disableCmsMfa(input: { currentPassword: string } & CmsMfaProof) {
  const payload = await requestCms(CMS_AUTH_PATHS.disableMfa, {
    method: "DELETE",
    body: input,
    csrf: true
  });

  if (payload?.ok !== true || payload.disabled !== true) {
    throw new CmsAuthError(503);
  }
}

export async function inspectCmsInvitation(token: string): Promise<CmsInvitationInspection> {
  const payload = await requestCms(CMS_AUTH_PATHS.inspectInvitation, { method: "POST", body: { token } });
  const user = payload?.user;

  if (
    payload?.valid !== true ||
    !isRecord(user) ||
    typeof user.email !== "string" ||
    typeof user.name !== "string" ||
    !(typeof user.username === "string" || user.username === null) ||
    !isCmsRole(user.role) ||
    typeof payload.expiresAt !== "string"
  ) {
    throw new CmsAuthError(503);
  }

  return {
    valid: true,
    user: {
      email: user.email,
      name: user.name,
      role: user.role,
      username: user.username
    },
    expiresAt: payload.expiresAt
  };
}

export async function acceptCmsInvitation(input: {
  token: string;
  username?: string;
  password: string;
  passwordConfirmation: string;
}) {
  const payload = await requestCms(CMS_AUTH_PATHS.acceptInvitation, { method: "POST", body: input });

  if (payload?.ok !== true || payload.credentialConfigured !== true) {
    throw new CmsAuthError(503);
  }
}

export async function inspectCmsPasswordReset(token: string): Promise<CmsPasswordResetInspection> {
  const payload = await requestCms(CMS_AUTH_PATHS.inspectPasswordReset, { method: "POST", body: { token } });

  if (
    payload?.valid !== true ||
    !isRecord(payload.user) ||
    typeof payload.user.emailHint !== "string" ||
    typeof payload.expiresAt !== "string"
  ) {
    throw new CmsAuthError(503);
  }

  return {
    valid: true,
    user: { emailHint: payload.user.emailHint },
    expiresAt: payload.expiresAt
  };
}

export async function completeCmsPasswordReset(token: string, password: string, passwordConfirmation: string) {
  const payload = await requestCms(CMS_AUTH_PATHS.completePasswordReset, {
    method: "POST",
    body: { token, password, passwordConfirmation }
  });

  if (payload?.ok !== true || payload.passwordReset !== true) {
    throw new CmsAuthError(503);
  }
}
