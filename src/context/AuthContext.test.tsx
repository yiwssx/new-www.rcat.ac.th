import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CMS_SESSION_EXPIRED_EVENT, CmsAuthError, cmsStepUpCoordinator, type CmsSafeUser } from "../features/cms-auth";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./authSessionContext";

const cmsAuthMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  getCapabilities: vi.fn(),
  login: vi.fn(),
  verifyMfa: vi.fn(),
  logout: vi.fn(),
  logoutAll: vi.fn(),
  reauthenticate: vi.fn()
}));

vi.mock("../features/cms-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/cms-auth")>();
  return {
    ...actual,
    getCmsSession: cmsAuthMock.getSession,
    getCmsCapabilities: cmsAuthMock.getCapabilities,
    loginCmsAccount: cmsAuthMock.login,
    verifyCmsMfa: cmsAuthMock.verifyMfa,
    logoutCmsSession: cmsAuthMock.logout,
    logoutAllCmsSessions: cmsAuthMock.logoutAll,
    reauthenticateCmsSession: cmsAuthMock.reauthenticate
  };
});

const user: CmsSafeUser = {
  id: "user-1",
  email: "admin@example.test",
  name: "Admin",
  username: "admin",
  role: "admin",
  isRoot: false,
  recentPasswordAuthentication: true,
  recentMfaAuthentication: false
};
const capabilities = ["dashboard.read", "users.read-all"] as const;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

class FakeBroadcastChannel {
  static listeners = new Set<(event: MessageEvent<unknown>) => void>();
  static messages: unknown[] = [];

  addEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) {
    FakeBroadcastChannel.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) {
    FakeBroadcastChannel.listeners.delete(listener);
  }

  postMessage(message: unknown) {
    FakeBroadcastChannel.messages.push(message);
  }

  close() {}

  static emit(message: "session-changed" | "logged-out") {
    for (const listener of FakeBroadcastChannel.listeners) {
      listener({ data: message } as MessageEvent<unknown>);
    }
  }

  static reset() {
    FakeBroadcastChannel.listeners.clear();
    FakeBroadcastChannel.messages = [];
  }
}

function AuthState() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  return (
    <div>
      <span>status:{auth.status}</span>
      <span>user:{auth.session?.user.id ?? "none"}</span>
      <span>capabilities:{auth.capabilities.join(",")}</span>
      <span>{error}</span>
      <button
        onClick={() =>
          void auth.login("admin", " password ").catch((currentError) => {
            setError(currentError instanceof Error ? currentError.message : "error");
          })
        }
      >
        login
      </button>
      <button onClick={() => void auth.logout().catch(() => undefined)}>logout</button>
      <button
        onClick={() =>
          void auth.refreshSession().catch((currentError) => {
            setError(currentError instanceof Error ? currentError.message : "error");
          })
        }
      >
        refresh
      </button>
      <button
        onClick={() =>
          void auth.reauthenticate({ currentPassword: "password" }).catch((currentError) => {
            setError(currentError instanceof Error ? currentError.message : "error");
          })
        }
      >
        reauthenticate
      </button>
      <button onClick={() => queryClient.setQueryData(["admin-users"], { account: "A" })}>seed</button>
      <span>cache:{queryClient.getQueryData(["admin-users"]) ? "present" : "empty"}</span>
    </div>
  );
}

function renderAuth(ui: ReactNode = <AuthState />) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{ui}</AuthProvider>
      </QueryClientProvider>
    )
  };
}

describe("CMS AuthProvider", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    cmsStepUpCoordinator.resetForTests();
    FakeBroadcastChannel.reset();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    cmsAuthMock.getSession.mockResolvedValue(user);
    cmsAuthMock.getCapabilities.mockResolvedValue({ role: "admin", capabilities: [...capabilities] });
    cmsAuthMock.login.mockResolvedValue({ kind: "authenticated", user });
    cmsAuthMock.verifyMfa.mockResolvedValue(user);
    cmsAuthMock.logout.mockResolvedValue(null);
    cmsAuthMock.logoutAll.mockResolvedValue(null);
    cmsAuthMock.reauthenticate.mockResolvedValue({
      recentPasswordAuthentication: true,
      recentMfaAuthentication: false
    });
  });

  it("keeps bootstrap explicit and restores a validated server Session", async () => {
    cmsAuthMock.getSession.mockImplementation(
      () => new Promise((resolve) => window.setTimeout(() => resolve(user), 20))
    );
    renderAuth();

    expect(screen.getByText("status:bootstrapping")).toBeInTheDocument();
    expect(await screen.findByText("status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("user:user-1")).toBeInTheDocument();
    expect(screen.getByText("capabilities:dashboard.read,users.read-all")).toBeInTheDocument();
  });

  it("keeps authenticated UI mounted during a background Session refresh", async () => {
    renderAuth();
    await screen.findByText("status:authenticated");
    let resolveSession!: (value: CmsSafeUser) => void;
    cmsAuthMock.getSession.mockImplementationOnce(
      () =>
        new Promise<CmsSafeUser>((resolve) => {
          resolveSession = resolve;
        })
    );

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(2));
    expect(screen.getByText("status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("user:user-1")).toBeInTheDocument();

    resolveSession(user);
    await waitFor(() => expect(cmsAuthMock.getCapabilities).toHaveBeenCalledTimes(2));
    expect(screen.getByText("status:authenticated")).toBeInTheDocument();
  });

  it("maps HTTP 401 to unauthenticated and HTTP 503 to unavailable", async () => {
    cmsAuthMock.getSession.mockRejectedValueOnce(new CmsAuthError(401));
    const first = renderAuth();
    expect(await screen.findByText("status:unauthenticated")).toBeInTheDocument();
    first.unmount();

    cmsAuthMock.getSession.mockRejectedValueOnce(new CmsAuthError(503));
    renderAuth();
    expect(await screen.findByText("status:unavailable")).toBeInTheDocument();
  });

  it("fails closed for a capability role mismatch or invalid capability response", async () => {
    cmsAuthMock.getCapabilities.mockResolvedValueOnce({
      role: "viewer",
      capabilities: ["dashboard.read"]
    });
    const mismatch = renderAuth();
    expect(await screen.findByText("status:unavailable")).toBeInTheDocument();
    mismatch.unmount();

    cmsAuthMock.getCapabilities.mockRejectedValueOnce(new TypeError("unknown capability"));
    renderAuth();
    expect(await screen.findByText("status:unavailable")).toBeInTheDocument();
  });

  it("refreshes authoritative Session state after password Login", async () => {
    renderAuth();
    await screen.findByText("status:authenticated");
    cmsAuthMock.getSession.mockClear();
    cmsAuthMock.getCapabilities.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => {
      expect(cmsAuthMock.login).toHaveBeenCalledWith("admin", " password ");
      expect(cmsAuthMock.getSession).toHaveBeenCalled();
      expect(cmsAuthMock.getCapabilities).toHaveBeenCalled();
    });
  });

  it("clears protected cache on Logout even when the server request fails", async () => {
    cmsAuthMock.logout.mockRejectedValueOnce(new Error("network"));
    const { queryClient } = renderAuth();
    await screen.findByText("status:authenticated");
    fireEvent.click(screen.getByRole("button", { name: "seed" }));
    expect(queryClient.getQueryData(["admin-users"])).toEqual({ account: "A" });

    fireEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => {
      expect(screen.getByText("status:unauthenticated")).toBeInTheDocument();
      expect(queryClient.getQueryData(["admin-users"])).toBeUndefined();
    });
  });

  it("clears Session and protected cache and broadcasts Logout for the global expiry event", async () => {
    const { queryClient } = renderAuth();
    await screen.findByText("status:authenticated");
    fireEvent.click(screen.getByRole("button", { name: "seed" }));
    expect(queryClient.getQueryData(["admin-users"])).toEqual({ account: "A" });

    act(() => window.dispatchEvent(new CustomEvent(CMS_SESSION_EXPIRED_EVENT)));

    await waitFor(() => {
      expect(screen.getByText("status:unauthenticated")).toBeInTheDocument();
      expect(queryClient.getQueryData(["admin-users"])).toBeUndefined();
    });
    expect(FakeBroadcastChannel.messages).toEqual(["logged-out"]);
  });

  it("removes account A protected data before account B becomes active", async () => {
    const secondUser = { ...user, id: "user-2", email: "second@example.test" };
    renderAuth();
    await screen.findByText("user:user-1");
    fireEvent.click(screen.getByRole("button", { name: "seed" }));
    cmsAuthMock.getSession.mockResolvedValue(secondUser);

    fireEvent.click(screen.getByRole("button", { name: "login" }));

    expect(await screen.findByText("user:user-2")).toBeInTheDocument();
    expect(screen.getByText("cache:empty")).toBeInTheDocument();
  });

  it("forces server revalidation for a logged-out hint and keeps a still-valid Session", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);

    renderAuth();
    await screen.findByText("user:user-1");
    cmsAuthMock.getSession.mockClear();
    cmsAuthMock.getCapabilities.mockClear();

    act(() => FakeBroadcastChannel.emit("logged-out"));

    await waitFor(() => {
      expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(1);
      expect(cmsAuthMock.getCapabilities).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("user:user-1")).toBeInTheDocument();
    expect(FakeBroadcastChannel.messages).toEqual([]);
  });

  it("clears Session only after a logged-out hint is confirmed by server 401", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    renderAuth();
    await screen.findByText("user:user-1");
    cmsAuthMock.getSession.mockRejectedValueOnce(new CmsAuthError(401));

    act(() => FakeBroadcastChannel.emit("logged-out"));

    expect(await screen.findByText("status:unauthenticated")).toBeInTheDocument();
    expect(screen.getByText("user:none")).toBeInTheDocument();
    expect(FakeBroadcastChannel.messages).toEqual([]);
  });

  it("forces a new generation for session-changed and ignores the older successful response", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const secondUser = { ...user, id: "user-2", email: "second@example.test" };
    const staleSession = createDeferred<CmsSafeUser>();
    renderAuth();
    await screen.findByText("user:user-1");
    cmsAuthMock.getSession.mockImplementationOnce(() => staleSession.promise).mockResolvedValueOnce(secondUser);

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(2));
    act(() => FakeBroadcastChannel.emit("session-changed"));

    expect(await screen.findByText("user:user-2")).toBeInTheDocument();
    await act(async () => {
      staleSession.resolve(user);
      await staleSession.promise;
    });
    expect(screen.getByText("user:user-2")).toBeInTheDocument();
    expect(FakeBroadcastChannel.messages).toEqual([]);
  });

  it("does not let a stale account-A response restore its protected cache after account B Login", async () => {
    const secondUser = { ...user, id: "user-2", email: "second@example.test" };
    const staleSession = createDeferred<CmsSafeUser>();
    const { queryClient } = renderAuth();
    await screen.findByText("user:user-1");
    fireEvent.click(screen.getByRole("button", { name: "seed" }));
    expect(queryClient.getQueryData(["admin-users"])).toEqual({ account: "A" });
    cmsAuthMock.getSession.mockImplementationOnce(() => staleSession.promise).mockResolvedValueOnce(secondUser);

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "login" }));

    expect(await screen.findByText("user:user-2")).toBeInTheDocument();
    expect(queryClient.getQueryData(["admin-users"])).toBeUndefined();
    await act(async () => {
      staleSession.resolve(user);
      await staleSession.promise;
    });
    expect(screen.getByText("user:user-2")).toBeInTheDocument();
    expect(queryClient.getQueryData(["admin-users"])).toBeUndefined();
  });

  it("does not let a stale 401 clear a newer account-B Session", async () => {
    const secondUser = { ...user, id: "user-2", email: "second@example.test" };
    const staleSession = createDeferred<CmsSafeUser>();
    renderAuth();
    await screen.findByText("user:user-1");
    cmsAuthMock.getSession.mockImplementationOnce(() => staleSession.promise).mockResolvedValueOnce(secondUser);

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "login" }));
    expect(await screen.findByText("user:user-2")).toBeInTheDocument();

    await act(async () => {
      staleSession.reject(new CmsAuthError(401));
      await staleSession.promise.catch(() => undefined);
    });
    expect(screen.getByText("status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("user:user-2")).toBeInTheDocument();
  });

  it("does not let a stale 503 downgrade a newer account-B Session", async () => {
    const secondUser = { ...user, id: "user-2", email: "second@example.test" };
    const staleSession = createDeferred<CmsSafeUser>();
    renderAuth();
    await screen.findByText("user:user-1");
    cmsAuthMock.getSession.mockImplementationOnce(() => staleSession.promise).mockResolvedValueOnce(secondUser);

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "login" }));
    expect(await screen.findByText("user:user-2")).toBeInTheDocument();

    await act(async () => {
      staleSession.reject(new CmsAuthError(503));
      await staleSession.promise.catch(() => undefined);
    });
    expect(screen.getByText("status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("user:user-2")).toBeInTheDocument();
  });

  it("rejects step-up waiters and clears Session when reauthentication refresh returns 401", async () => {
    renderAuth();
    await screen.findByText("status:authenticated");
    const waiter = cmsStepUpCoordinator.request("password");
    cmsAuthMock.getSession.mockRejectedValueOnce(new CmsAuthError(401));

    fireEvent.click(screen.getByRole("button", { name: "reauthenticate" }));

    await expect(waiter).rejects.toMatchObject({ status: 401 });
    expect(await screen.findByText("status:unauthenticated")).toBeInTheDocument();
    expect(screen.getByText("user:none")).toBeInTheDocument();
    expect(cmsStepUpCoordinator.getSnapshot().open).toBe(false);
  });

  it("rejects step-up waiters without unmounting authenticated UI when reauthentication refresh returns 503", async () => {
    renderAuth();
    await screen.findByText("status:authenticated");
    const waiter = cmsStepUpCoordinator.request("mfa");
    cmsAuthMock.getSession.mockRejectedValueOnce(new CmsAuthError(503));

    fireEvent.click(screen.getByRole("button", { name: "reauthenticate" }));

    await expect(waiter).rejects.toMatchObject({ status: 503 });
    expect(screen.getByText("status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("user:user-1")).toBeInTheDocument();
    expect(cmsStepUpCoordinator.getSnapshot().open).toBe(false);
  });
});
