import { ReactNode, useCallback, useMemo, useState } from "react";
import { projectSettings } from "../config/projectSettings";
import { restoreSession } from "../services/authSession";
import {
  isAdminProxySessionEnabled,
  loginAdminProxySession,
  logoutAdminProxySession
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

  const login = useCallback(async (email: string, password: string) => {
    const { login: requestLogin } = await import("../services/auth");
    const nextSession = await requestLogin(email, password);

    if (isAdminProxySessionEnabled()) {
      try {
        await loginAdminProxySession(email, password);
      } catch (error) {
        try {
          await logoutAdminProxySession();
        } catch {
          // Preserve the original login error after a best-effort cookie cleanup.
        }
        window.localStorage.removeItem(projectSettings.storageKeys.session);
        setSession(null);
        throw error;
      }
    }

    window.localStorage.setItem(projectSettings.storageKeys.session, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const logout = useCallback(async () => {
    if (isAdminProxySessionEnabled()) {
      await logoutAdminProxySession();
    }

    window.localStorage.removeItem(projectSettings.storageKeys.session);
    setSession(null);
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
