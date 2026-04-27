import { jwtDecode } from "jwt-decode";
import { getGoogleAppsScriptUrl, projectSettings } from "../config/projectSettings";
import { Session, User } from "../types";
import { loginUserFromApi } from "./googleApi";
import { authenticateUser } from "./users";

interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  role: User["role"];
  exp: number;
}

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
    return loginUserFromApi(email, password);
  }

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

export function isTokenExpired(token: string, expiresAt?: string) {
  try {
    const payload = jwtDecode<JwtPayload>(token);
    if (payload?.exp) {
      return payload.exp * 1000 <= Date.now();
    }
  } catch {
    // Fall back to expiresAt if token is opaque.
  }

  if (!expiresAt) {
    return true;
  }

  return Date.parse(expiresAt) <= Date.now();
}

export function restoreSession(value: string | null): Session | null {
  if (!value) {
    return null;
  }

  try {
    const session = JSON.parse(value) as Session;
    if (!session?.token || !session?.expiresAt || !session?.user) {
      return null;
    }

    return isTokenExpired(session.token, session.expiresAt) ? null : session;
  } catch {
    return null;
  }
}
