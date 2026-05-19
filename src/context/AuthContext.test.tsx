import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../services/auth", () => {
  authModuleMock.loaded = true;
  return {
    login: authModuleMock.login
  };
});

function LoginButton() {
  const { login } = useAuth();

  return <button onClick={() => void login("admin@example.com", "password")}>Login</button>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    authModuleMock.loaded = false;
    authModuleMock.login.mockClear();
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
});
