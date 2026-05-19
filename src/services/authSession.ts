import { jwtDecode } from "jwt-decode";
import { Session, User } from "../types";

interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  role: User["role"];
  exp: number;
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
