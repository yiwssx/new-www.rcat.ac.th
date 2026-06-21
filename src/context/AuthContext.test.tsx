import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectSettings } from "../config/projectSettings";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./authSessionContext";

const authModuleMock = vi.hoisted(() => ({
  loaded: false,
  login: vi.fn(async () => ({
    user: {
      id: "user-test",
      name: "Test User",
      email: "admin@example.com",
      role: "admin" as const
    },
    token: "local.test.token",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  }))
}));

const adminProxySessionMock = vi.hoisted(() => ({
  enabled: false,
  login: vi.fn(async () => ({
    user: {
      id: "admin-proxy:admin@example.com",
      name: "admin",
      email: "admin@example.com",
      role: "admin" as const
    },
    token: "admin-proxy.local.test.token",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  })),
  logout: vi.fn(async () => undefined)
}));

vi.mock("../services/auth", () => {
  authModuleMock.loaded = true;
  return {
    login: authModuleMock.login
  };
});

vi.mock("../services/adminProxySession", () => ({
  ADMIN_PROXY_SESSION_EXPIRED_EVENT: "rcat:admin-proxy-session-expired",
  isAdminProxySessionEnabled: () => adminProxySessionMock.enabled,
  loginCloudflareAdminProxySession: adminProxySessionMock.login,
  logoutAdminProxySession: adminProxySessionMock.logout
}));

function LoginButton() {
  const { login } = useAuth();

  return <button onClick={() => void login("admin@example.com", "password")}>Login</button>;
}

function AuthStateControls() {
  const { login, logout, session } = useAuth();
  const [error, setError] = useState("");

  async function handleLogin() {
    try {
      await login("admin@example.com", "password");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Login failed");
    }
  }

  return (
    <div>
      <span>{session ? "Signed in" : "Signed out"}</span>
      <span>{error}</span>
      <button onClick={() => void handleLogin()}>Login state</button>
      <button onClick={() => void logout()}>Logout state</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    authModuleMock.loaded = false;
    authModuleMock.login.mockClear();
    adminProxySessionMock.enabled = false;
    adminProxySessionMock.login.mockReset();
    adminProxySessionMock.login.mockResolvedValue({
      user: {
        id: "admin-proxy:admin@example.com",
        name: "admin",
        email: "admin@example.com",
        role: "admin"
      },
      token: "admin-proxy.local.test.token",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    adminProxySessionMock.logout.mockReset();
    adminProxySessionMock.logout.mockResolvedValue(undefined);
  });

  it("restores session state without loading credential auth code", () => {
    render(
      <AuthProvider>
        <div>Public route</div>
      </AuthProvider>
    );

    expect(screen.getByText("Public route")).toBeInTheDocument();
    expect(authModuleMock.loaded).toBe(false);
  });

  it("loads credential auth code only when login is attempted", async () => {
    render(
      <AuthProvider>
        <LoginButton />
      </AuthProvider>
    );

    expect(authModuleMock.loaded).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(authModuleMock.login).toHaveBeenCalledWith("admin@example.com", "password");
    });
    expect(authModuleMock.loaded).toBe(true);
    expect(window.localStorage.getItem(projectSettings.storageKeys.session)).toContain("local.test.token");
  });

  it("establishes the server proxy session before persisting local admin state", async () => {
    adminProxySessionMock.enabled = true;
    adminProxySessionMock.login.mockImplementation(async () => {
      expect(window.localStorage.getItem(projectSettings.storageKeys.session)).toBeNull();
      return {
        user: {
          id: "admin-proxy:admin@example.com",
          name: "admin",
          email: "admin@example.com",
          role: "admin"
        },
        token: "admin-proxy.local.test.token",
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      };
    });
    render(
      <AuthProvider>
        <AuthStateControls />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Login state" }));

    await waitFor(() => {
      expect(adminProxySessionMock.login).toHaveBeenCalledWith("admin@example.com", "password");
      expect(screen.getByText("Signed in")).toBeInTheDocument();
    });
    expect(authModuleMock.loaded).toBe(false);
    expect(authModuleMock.login).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(projectSettings.storageKeys.session)).toContain("admin-proxy.local.test.token");
  });

  it("does not retain local admin state when the server proxy session login fails", async () => {
    adminProxySessionMock.enabled = true;
    adminProxySessionMock.login.mockRejectedValue(new Error("Admin proxy session login failed"));
    window.localStorage.setItem(projectSettings.storageKeys.session, JSON.stringify(await authModuleMock.login()));
    render(
      <AuthProvider>
        <AuthStateControls />
      </AuthProvider>
    );

    expect(screen.getByText("Signed in")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Login state" }));

    await waitFor(() => {
      expect(adminProxySessionMock.login).toHaveBeenCalled();
      expect(adminProxySessionMock.logout).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Admin proxy session login failed")).toBeInTheDocument();
    });
    expect(screen.getByText("Signed out")).toBeInTheDocument();
    expect(window.localStorage.getItem(projectSettings.storageKeys.session)).toBeNull();
  });

  it("clears the server proxy session when logging out", async () => {
    adminProxySessionMock.enabled = true;
    window.localStorage.setItem(projectSettings.storageKeys.session, JSON.stringify(await authModuleMock.login()));
    render(
      <AuthProvider>
        <AuthStateControls />
      </AuthProvider>
    );

    expect(screen.getByText("Signed in")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Logout state" }));

    await waitFor(() => {
      expect(adminProxySessionMock.logout).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Signed out")).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(projectSettings.storageKeys.session)).toBeNull();
  });

  it("clears local auth immediately when the HttpOnly proxy session expires", async () => {
    window.localStorage.setItem(projectSettings.storageKeys.session, JSON.stringify(await authModuleMock.login()));
    render(
      <AuthProvider>
        <AuthStateControls />
      </AuthProvider>
    );

    expect(screen.getByText("Signed in")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent("rcat:admin-proxy-session-expired"));
    });

    await waitFor(() => {
      expect(screen.getByText("Signed out")).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(projectSettings.storageKeys.session)).toBeNull();
    expect(adminProxySessionMock.logout).not.toHaveBeenCalled();
  });
});
