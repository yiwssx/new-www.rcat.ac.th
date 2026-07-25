import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { projectSettings } from "../config/projectSettings";
import {
  broadcastCmsSessionEvent,
  clearProtectedAdminQueries,
  CMS_SESSION_EXPIRED_EVENT,
  cmsStepUpCoordinator,
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
  const sessionRef = useRef<CmsSession | null>(null);
  const refreshGenerationRef = useRef(0);
  const refreshRequestRef = useRef<{
    generation: number;
    promise: Promise<CmsSession | null>;
  } | null>(null);

  const commitClearedSession = useCallback(
    (error: CmsAuthError) => {
      currentUserIdRef.current = "";
      sessionRef.current = null;
      setSession(null);
      setStatus("unauthenticated");
      clearProtectedAdminQueries(queryClient);
      cmsStepUpCoordinator.fail(error);
    },
    [queryClient]
  );

  const clearSession = useCallback(
    (options: { broadcast?: boolean } = {}) => {
      refreshGenerationRef.current += 1;
      refreshRequestRef.current = null;
      commitClearedSession(new CmsAuthError(401));

      if (options.broadcast) {
        broadcastCmsSessionEvent("logged-out");
      }
    },
    [commitClearedSession]
  );

  const refreshSession = useCallback(
    (options: { force?: boolean } = {}) => {
      if (!options.force && refreshRequestRef.current) {
        return refreshRequestRef.current.promise;
      }

      const generation = refreshGenerationRef.current + 1;
      refreshGenerationRef.current = generation;
      const backgroundRefresh = sessionRef.current !== null;

      if (!backgroundRefresh) {
        setStatus("bootstrapping");
      }

      const refreshPromise = (async () => {
        try {
          const [sessionResult, capabilityResult] = await Promise.allSettled([getCmsSession(), getCmsCapabilities()]);

          const failures = [sessionResult, capabilityResult]
            .filter((result): result is PromiseRejectedResult => result.status === "rejected")
            .map((result) => result.reason);
          const failure =
            failures.find((error) => error instanceof CmsAuthError && error.status === 401) ?? failures[0];

          if (failure) {
            throw failure;
          }

          if (generation !== refreshGenerationRef.current) {
            return sessionRef.current;
          }

          if (sessionResult.status !== "fulfilled" || capabilityResult.status !== "fulfilled") {
            throw new TypeError("CMS Session refresh did not return complete authorization state");
          }

          const user = sessionResult.value;
          const capabilityPayload = capabilityResult.value;

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
          sessionRef.current = nextSession;
          setSession(nextSession);
          setStatus("authenticated");
          return nextSession;
        } catch (error) {
          if (generation !== refreshGenerationRef.current) {
            return sessionRef.current;
          }

          if (error instanceof CmsAuthError && error.status === 401) {
            commitClearedSession(error);
            return null;
          }

          if (sessionRef.current) {
            setStatus("authenticated");
            throw error;
          }

          currentUserIdRef.current = "";
          sessionRef.current = null;
          setSession(null);
          clearProtectedAdminQueries(queryClient);
          setStatus("unavailable");
          throw error;
        }
      })();

      refreshRequestRef.current = { generation, promise: refreshPromise };
      const clearRefreshPromise = () => {
        if (refreshRequestRef.current?.generation === generation) {
          refreshRequestRef.current = null;
        }
      };
      void refreshPromise.then(clearRefreshPromise, clearRefreshPromise);
      return refreshPromise;
    },
    [commitClearedSession, queryClient]
  );

  const login = useCallback(
    async (identifier: string, password: string): Promise<CmsLoginResult> => {
      const result = await loginCmsAccount(identifier, password);

      if (result.kind === "authenticated") {
        await refreshSession({ force: true });
        broadcastCmsSessionEvent("session-changed");
      }

      return result;
    },
    [refreshSession]
  );

  const verifyMfa = useCallback(
    async (proof: CmsMfaProof) => {
      await verifyCmsMfa(proof);
      const nextSession = await refreshSession({ force: true });

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

      try {
        const nextSession = await refreshSession({ force: true });

        if (!nextSession) {
          throw new CmsAuthError(401);
        }
      } catch (error) {
        cmsStepUpCoordinator.fail(error);
        throw error;
      }

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
      void refreshSession({ force: true }).catch(() => undefined);
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
