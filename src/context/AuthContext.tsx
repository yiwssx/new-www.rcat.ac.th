import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo
} from "react";
import { projectSettings } from "../config/projectSettings";
import { Session } from "../types";
import { login as requestLogin } from "../services/auth";
import { selectSession, sessionEnded, sessionStarted } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

interface AuthContextValue {
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);

  const login = useCallback(async (email: string, password: string) => {
    const nextSession = await requestLogin(email, password);
    window.localStorage.setItem(projectSettings.storageKeys.session, JSON.stringify(nextSession));
    dispatch(sessionStarted(nextSession));
  }, [dispatch]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(projectSettings.storageKeys.session);
    dispatch(sessionEnded());
  }, [dispatch]);

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

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
