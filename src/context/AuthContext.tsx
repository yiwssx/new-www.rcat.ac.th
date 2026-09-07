import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  broadcastCmsSessionEvent,
  clearCmsSessionNotice,
  clearProtectedAdminQueries,
  CMS_SESSION_EXPIRED_EVENT,
  CMS_SESSION_KEEPALIVE_CHECK_INTERVAL_MS,
  CMS_SESSION_KEEPALIVE_INTERVAL_MS,
  CMS_SESSION_RECENT_ACTIVITY_MS,
  cmsStepUpCoordinator,
  getCmsCapabilities,
  getCmsSession,
  hasCmsCapability,
  loginCmsAccount,
  logoutAllCmsSessions,
  logoutCmsSession,
  notifyCmsSessionExpired,
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

async function retryCmsAuthorizationRead<T>(read: () => Promise<T>) {
  try {
    return await read();
  } catch (error) {
    if (!(error instanceof CmsAuthError && error.status === 401)) {
      throw error;
    }

    // Authorization reads are idempotent. Retry one 401 once to tolerate a
    // transient disagreement between same-origin auth/admin proxy paths.
    // Persistent 401 responses still fail closed and mutations are never retried.
    return read();
  }
}

async function readCmsAuthorizationState() {
  const [sessionResult, capabilityResult] = await Promise.allSettled([getCmsSession(), getCmsCapabilities()]);
  const failures = [sessionResult, capabilityResult]
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason);
  const failure = failures.find((error) => error instanceof CmsAuthError && error.status === 401) ?? failures[0];

  if (failure) {
    throw failure;
  }

  if (sessionResult.status !== "fulfilled" || capabilityResult.status !== "fulfilled") {
    throw new TypeError("CMS Session refresh did not return complete authorization state");
  }

  return { user: sessionResult.value, capabilityPayload: capabilityResult.value };
}

async function readCmsAuthorizationStateWithBounded401Retry() {
  const user = await retryCmsAuthorizationRead(getCmsSession);
  const capabilityPayload = await retryCmsAuthorizationRead(getCmsCapabilities);
  return { user, capabilityPayload };
}

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
  const sessionExpiryConfirmationRef = useRef<Promise<void> | null>(null);
  const lastAdminActivityAtRef = useRef(0);
  const lastSessionRefreshAtRef = useRef(0);

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
    (options: { force?: boolean; activityKeepalive?: boolean; retryAuthorization401?: boolean } = {}) => {
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
          const { user, capabilityPayload } = options.retryAuthorization401
            ? await readCmsAuthorizationStateWithBounded401Retry()
            : await readCmsAuthorizationState();

          if (generation !== refreshGenerationRef.current) {
            return sessionRef.current;
          }

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
          lastSessionRefreshAtRef.current = Date.now();
          setSession(nextSession);
          setStatus("authenticated");
          return nextSession;
        } catch (error) {
          if (generation !== refreshGenerationRef.current) {
            return sessionRef.current;
          }

          if (error instanceof CmsAuthError && error.status === 401) {
            if (backgroundRefresh && options.activityKeepalive) {
              notifyCmsSessionExpired();
              return null;
            }

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
        const nextSession = await refreshSession({ force: true, retryAuthorization401: true });

        if (!nextSession) {
          throw new CmsAuthError(401);
        }

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
    const bootstrapTimer = window.setTimeout(() => {
      // Bootstrap performs only idempotent authorization reads. Confirm one
      // transient 401 before clearing a valid browser Session; a repeated 401
      // still fails closed and no mutation is replayed.
      void refreshSession({ retryAuthorization401: true }).catch(() => undefined);
    }, 0);

    return () => window.clearTimeout(bootstrapTimer);
  }, [refreshSession]);

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const shouldConfirm =
        event instanceof CustomEvent &&
        event.detail &&
        typeof event.detail === "object" &&
        event.detail.confirmSession === true;

      if (!shouldConfirm) {
        clearSession({ broadcast: true });
        return;
      }

      if (sessionExpiryConfirmationRef.current) {
        return;
      }

      // A proxy 401 can race with sibling authorization reads. Confirm through
      // the authoritative Session/capability GETs before clearing global state.
      // Reuse an in-flight auth refresh when present; otherwise allow one bounded
      // 401 retry on those idempotent reads. Mutations are never replayed.
      const confirmationSource = refreshRequestRef.current?.promise ?? refreshSession({ retryAuthorization401: true });
      const confirmationPromise = confirmationSource
        .then((nextSession) => {
          if (nextSession) {
            clearCmsSessionNotice();
            return;
          }

          clearSession({ broadcast: true });
        })
        .catch(() => {
          clearSession({ broadcast: true });
        });

      sessionExpiryConfirmationRef.current = confirmationPromise;
      void confirmationPromise.finally(() => {
        if (sessionExpiryConfirmationRef.current === confirmationPromise) {
          sessionExpiryConfirmationRef.current = null;
        }
      });
    };
    const unsubscribe = subscribeToCmsSessionEvents(() => {
      void refreshSession({ force: true }).catch(() => undefined);
    });

    window.addEventListener(CMS_SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      unsubscribe();
      window.removeEventListener(CMS_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [clearSession, refreshSession]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user.id) {
      lastAdminActivityAtRef.current = 0;
      return;
    }

    let disposed = false;
    const recordActivity = () => {
      lastAdminActivityAtRef.current = Date.now();
    };
    const keepSessionAliveIfEligible = () => {
      const now = Date.now();

      if (
        disposed ||
        !window.location.pathname.startsWith("/admin") ||
        document.visibilityState !== "visible" ||
        lastAdminActivityAtRef.current === 0 ||
        now - lastAdminActivityAtRef.current > CMS_SESSION_RECENT_ACTIVITY_MS ||
        now - lastSessionRefreshAtRef.current < CMS_SESSION_KEEPALIVE_INTERVAL_MS
      ) {
        return;
      }

      lastSessionRefreshAtRef.current = now;
      void refreshSession({ activityKeepalive: true }).catch(() => undefined);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      recordActivity();
      keepSessionAliveIfEligible();
    };
    const activityEvents: Array<keyof WindowEventMap> = ["keydown", "input", "pointerdown", "touchstart"];

    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const keepaliveTimer = window.setInterval(keepSessionAliveIfEligible, CMS_SESSION_KEEPALIVE_CHECK_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(keepaliveTimer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshSession, session?.user.id, status]);

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
