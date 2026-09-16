import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsAuthError, type CmsSafeUser } from "../features/cms-auth";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./authSessionContext";

const cmsAuthMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  getCapabilities: vi.fn()
}));

vi.mock("../features/cms-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/cms-auth")>();
  return {
    ...actual,
    getCmsSession: cmsAuthMock.getSession,
    getCmsCapabilities: cmsAuthMock.getCapabilities
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

class FakeBroadcastChannel {
  addEventListener() {}
  removeEventListener() {}
  postMessage() {}
  close() {}
}

function AuthStatusProbe() {
  const auth = useAuth();
  return <span>status:{auth.status}</span>;
}

function renderAuth() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthStatusProbe />
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe("CMS authorization read ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    window.history.replaceState({}, "", "/login");
    cmsAuthMock.getCapabilities.mockResolvedValue({ role: "admin", capabilities: ["dashboard.read"] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not request capabilities when the anonymous Session check returns 401", async () => {
    cmsAuthMock.getSession.mockRejectedValue(new CmsAuthError(401));

    renderAuth();

    expect(await screen.findByText("status:unauthenticated")).toBeInTheDocument();
    expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(1);
    expect(cmsAuthMock.getCapabilities).not.toHaveBeenCalled();
  });

  it("waits for a validated Session before requesting capabilities", async () => {
    let resolveSession!: (value: CmsSafeUser) => void;
    cmsAuthMock.getSession.mockImplementation(
      () =>
        new Promise<CmsSafeUser>((resolve) => {
          resolveSession = resolve;
        })
    );

    renderAuth();

    await waitFor(() => expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(1));
    expect(cmsAuthMock.getCapabilities).not.toHaveBeenCalled();

    await act(async () => {
      resolveSession(user);
    });

    await waitFor(() => expect(cmsAuthMock.getCapabilities).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("status:authenticated")).toBeInTheDocument();
  });
});
