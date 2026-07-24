import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectSettings } from "../config/projectSettings";
import { CmsAuthError, type CmsSafeUser } from "../features/cms-auth";
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

  it("ignores and deletes the legacy localStorage Session without writing a replacement", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    window.localStorage.setItem(
      projectSettings.storageKeys.session,
      JSON.stringify({ token: "admin-proxy.local.secret", user: { role: "admin" } })
    );
    storageSpy.mockClear();

    renderAuth();
    expect(await screen.findByText("status:authenticated")).toBeInTheDocument();

    expect(window.localStorage.getItem(projectSettings.storageKeys.session)).toBeNull();
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("refreshes authoritative Session state after password Login", async () => {
    renderAuth();
    await screen.findByText("status:authenticated");
    cmsAuthMock.getSession.mockClear();
    cmsAuthMock.getCapabilities.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => {
      expect(cmsAuthMock.login).toHaveBeenCalledWith("admin", " password ");
      expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(1);
      expect(cmsAuthMock.getCapabilities).toHaveBeenCalledTimes(1);
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

  it("revalidates authoritative access after another tab logs in or out", async () => {
    class FakeBroadcastChannel {
      static listeners = new Set<(event: MessageEvent<unknown>) => void>();

      addEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) {
        FakeBroadcastChannel.listeners.add(listener);
      }

      removeEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) {
        FakeBroadcastChannel.listeners.delete(listener);
      }

      postMessage(_message: unknown) {}
      close() {}

      static emit(message: "session-changed" | "logged-out") {
        for (const listener of FakeBroadcastChannel.listeners) {
          listener({ data: message } as MessageEvent<unknown>);
        }
      }
    }
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);

    const secondUser = { ...user, id: "user-2", email: "second@example.test" };
    renderAuth();
    await screen.findByText("user:user-1");

    cmsAuthMock.getSession.mockResolvedValue(secondUser);
    act(() => FakeBroadcastChannel.emit("session-changed"));
    expect(await screen.findByText("user:user-2")).toBeInTheDocument();

    cmsAuthMock.getSession.mockRejectedValue(new CmsAuthError(401));
    act(() => FakeBroadcastChannel.emit("logged-out"));
    expect(await screen.findByText("status:unauthenticated")).toBeInTheDocument();
  });
});
