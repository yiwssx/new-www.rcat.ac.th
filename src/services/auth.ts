import { getGoogleAppsScriptUrl, projectSettings } from "../config/projectSettings";
import { Session, User } from "../types";
import { assertLocalAuthFallbackAllowed } from "./authRuntime";
export { isTokenExpired, restoreSession } from "./authSession";

function createLocalSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local.${crypto.randomUUID().replace(/-/g, "")}.${Date.now()}`;
  }

  return `local.${Math.random().toString(36).slice(2)}.${Date.now()}`;
}

export async function hashPassword(password: string) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 8);
}

export async function login(email: string, password: string): Promise<Session> {
  if (getGoogleAppsScriptUrl()) {
    const { loginUserFromApi } = await import("./googleApi");
    return loginUserFromApi(email, password);
  }

  assertLocalAuthFallbackAllowed();
  const { authenticateUser } = await import("./users");
  const account = await authenticateUser(email, password);
  const user: User = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    avatarUrl: account.avatarUrl
  };
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * projectSettings.auth.sessionHours);

  return {
    user,
    token: createLocalSessionToken(),
    expiresAt: expiresAt.toISOString()
  };
}
