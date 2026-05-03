import { ReactNode, useCallback, useMemo, useState } from "react";
import { projectSettings } from "../config/projectSettings";
import { Session } from "../types";
import { login as requestLogin, restoreSession } from "../services/auth";
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
    const nextSession = await requestLogin(email, password);
    window.localStorage.setItem(projectSettings.storageKeys.session, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
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
