import { resolveAdminWriteProvider, resolveCloudflareAdminWriteConfig } from "../config/adminWriteProvider";
import type { PublicApiProviderEnv } from "../config/publicApiProvider";

const loginPath = "/api/admin-proxy-session/login";
const logoutPath = "/api/admin-proxy-session/logout";

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
