import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { projectSettings } from "../config/projectSettings";
import {
  broadcastCmsSessionEvent,
  clearProtectedAdminQueries,
  CMS_SESSION_EXPIRED_EVENT,
  getCmsCapabilities,
  getCmsSession,
  hasCmsCapability,
  loginCmsAccount,
  logoutAllCmsSessions,
  logoutCmsSession,
  reauthenticateCmsSession,
  subscribeToCmsSessionEvents,
  verifyCmsMfa,
  CmsAuthError,
  type CmsAuthStatus,
  type CmsCapability,
  type CmsLoginResult,
  type CmsMfaProof,
  type CmsSession
} from "../features/cms-auth";
import { AuthContext } from "./authSessionContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CmsAuthStatus>("bootstrapping");
  const [session, setSession] = useState<CmsSession | null>(null);
  const currentUserIdRef = useRef("");

  const clearSession = useCallback(
    (options: { broadcast?: boolean } = {}) => {
      currentUserIdRef.current = "";
      setSession(null);
      setStatus("unauthenticated");
      clearProtectedAdminQueries(queryClient);

      if (options.broadcast) {
        broadcastCmsSessionEvent("logged-out");
      }
    },
    [queryClient]
  );

  const refreshSession = useCallback(async () => {
    setStatus("bootstrapping");

    try {
      const user = await getCmsSession();
      const capabilityPayload = await getCmsCapabilities();

      if (capabilityPayload.role !== user.role) {
        throw new TypeError("CMS Session role does not match the capability role");
      }

      if (currentUserIdRef.current && currentUserIdRef.current !== user.id) {
        clearProtectedAdminQueries(queryClient);
      }

      const nextSession: CmsSession = {
        user,
        capabilities: capabilityPayload.capabilities
      };
      currentUserIdRef.current = user.id;
      setSession(nextSession);
      setStatus("authenticated");
      return nextSession;
    } catch (error) {
      currentUserIdRef.current = "";
      setSession(null);
      clearProtectedAdminQueries(queryClient);

      if (error instanceof CmsAuthError && error.status === 401) {
        setStatus("unauthenticated");
        return null;
      }

      setStatus("unavailable");
      throw error;
    }
  }, [queryClient]);

  const login = useCallback(
    async (identifier: string, password: string): Promise<CmsLoginResult> => {
      const result = await loginCmsAccount(identifier, password);

      if (result.kind === "authenticated") {
        await refreshSession();
        broadcastCmsSessionEvent("session-changed");
      }

      return result;
    },
    [refreshSession]
  );

  const verifyMfa = useCallback(
    async (proof: CmsMfaProof) => {
      await verifyCmsMfa(proof);
      const nextSession = await refreshSession();

      if (!nextSession) {
        throw new CmsAuthError(401);
      }

      broadcastCmsSessionEvent("session-changed");
      return nextSession;
    },
    [refreshSession]
  );

  const logout = useCallback(async () => {
    try {
      await logoutCmsSession();
    } finally {
      clearSession({ broadcast: true });
    }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await logoutAllCmsSessions();
    } finally {
      clearSession({ broadcast: true });
    }
  }, [clearSession]);

  const reauthenticate = useCallback(
    async (input: { currentPassword: string } & Partial<CmsMfaProof>) => {
      await reauthenticateCmsSession(input);
      await refreshSession();
      broadcastCmsSessionEvent("session-changed");
    },
    [refreshSession]
  );

  const hasCapability = useCallback(
    (capability: CmsCapability) => hasCmsCapability(session?.capabilities, capability),
    [session?.capabilities]
  );

  useEffect(() => {
    window.localStorage.removeItem(projectSettings.storageKeys.session);
    const bootstrapTimer = window.setTimeout(() => {
      void refreshSession().catch(() => undefined);
    }, 0);

    return () => window.clearTimeout(bootstrapTimer);
  }, [refreshSession]);

  useEffect(() => {
    const handleSessionExpired = () => clearSession({ broadcast: true });
    const unsubscribe = subscribeToCmsSessionEvents(() => {
      void refreshSession().catch(() => undefined);
    });

    window.addEventListener(CMS_SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      unsubscribe();
      window.removeEventListener(CMS_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [clearSession, refreshSession]);

  const value = useMemo(
    () => ({
      status,
      session,
      capabilities: session?.capabilities ?? [],
      refreshSession,
      login,
      verifyMfa,
      logout,
      logoutAll,
      reauthenticate,
      hasCapability,
      clearSession
    }),
    [clearSession, hasCapability, login, logout, logoutAll, reauthenticate, refreshSession, session, status, verifyMfa]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
