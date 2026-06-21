import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { projectSettings } from "../config/projectSettings";
import { restoreSession } from "../services/authSession";
import {
  isAdminProxySessionEnabled,
  loginCloudflareAdminProxySession,
  logoutAdminProxySession,
  ADMIN_PROXY_SESSION_EXPIRED_EVENT
} from "../services/adminProxySession";
import { Session } from "../types";
import { AuthContext } from "./authSessionContext";

function getInitialSession() {
  if (typeof window === "undefined") {
    return null;
  }

  return restoreSession(window.localStorage.getItem(projectSettings.storageKeys.session));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => getInitialSession());

  useEffect(() => {
    const handleProxySessionExpired = () => {
      window.localStorage.removeItem(projectSettings.storageKeys.session);
      setSession(null);
    };

    window.addEventListener(ADMIN_PROXY_SESSION_EXPIRED_EVENT, handleProxySessionExpired);
    return () => window.removeEventListener(ADMIN_PROXY_SESSION_EXPIRED_EVENT, handleProxySessionExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const proxySessionEnabled = isAdminProxySessionEnabled();
    let nextSession: Session;

    try {
      if (proxySessionEnabled) {
        nextSession = await loginCloudflareAdminProxySession(email, password);
      } else {
        const { login: requestLogin } = await import("../services/auth");
        nextSession = await requestLogin(email, password);
      }
    } catch (error) {
      if (proxySessionEnabled) {
        try {
          await logoutAdminProxySession();
        } catch {
          // Preserve the original login error after a best-effort cookie cleanup.
        }
      }

      window.localStorage.removeItem(projectSettings.storageKeys.session);
      setSession(null);
      throw error;
    }

    window.localStorage.setItem(projectSettings.storageKeys.session, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (isAdminProxySessionEnabled()) {
        await logoutAdminProxySession();
      }
    } finally {
      window.localStorage.removeItem(projectSettings.storageKeys.session);
      setSession(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      login,
      logout
    }),
    [login, logout, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
