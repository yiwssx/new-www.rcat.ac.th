import { resolveAdminWriteProvider, resolveCloudflareAdminWriteConfig } from "../config/adminWriteProvider";
import type { PublicApiProviderEnv } from "../config/publicApiProvider";

const loginPath = "/api/admin-proxy-session/login";
const logoutPath = "/api/admin-proxy-session/logout";
export const ADMIN_PROXY_SESSION_EXPIRED_EVENT = "rcat:admin-proxy-session-expired";
export const ADMIN_PROXY_SESSION_NOTICE_KEY = "rcat.admin.proxy.session.notice";
export const ADMIN_PROXY_SESSION_EXPIRED_MESSAGE = "Session expired. Please sign in again.";

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown };

    return typeof payload.error === "string" && payload.error.trim() ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export function isAdminProxySessionEnabled(env: PublicApiProviderEnv = import.meta.env) {
  if (resolveAdminWriteProvider(env) !== "cloudflare") {
    return false;
  }

  try {
    return resolveCloudflareAdminWriteConfig(env).authMode === "server-proxy";
  } catch {
    return false;
  }
}

export async function loginAdminProxySession(email: string, password: string) {
  const response = await fetch(loginPath, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Unable to establish the admin proxy session"));
  }
}

export async function logoutAdminProxySession() {
  const response = await fetch(logoutPath, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Unable to clear the admin proxy session"));
  }
}

export function notifyAdminProxySessionExpired(message = ADMIN_PROXY_SESSION_EXPIRED_MESSAGE) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(ADMIN_PROXY_SESSION_NOTICE_KEY, message);
  } catch {
    // Session expiry must still clear local auth when storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent(ADMIN_PROXY_SESSION_EXPIRED_EVENT, { detail: { message } }));
}

export function consumeAdminProxySessionNotice() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const message = window.sessionStorage.getItem(ADMIN_PROXY_SESSION_NOTICE_KEY) || "";
    window.sessionStorage.removeItem(ADMIN_PROXY_SESSION_NOTICE_KEY);
    return message;
  } catch {
    return "";
  }
}
