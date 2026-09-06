import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CMS_SESSION_NOTICE_KEY,
  CmsAuthError,
  notifyCmsSessionExpired,
  type CmsSafeUser
} from "../features/cms-auth";
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

class FakeBroadcastChannel {
  static messages: unknown[] = [];

  addEventListener() {}
  removeEventListener() {}
  close() {}

  postMessage(message: unknown) {
    FakeBroadcastChannel.messages.push(message);
  }
}

const user: CmsSafeUser = {
  id: "user-1",
  email: "editor@example.test",
  name: "Editor",
  username: "editor",
  role: "editor",
  isRoot: false,
  recentPasswordAuthentication: true,
  recentMfaAuthentication: false
};

function AuthState() {
  const auth = useAuth();
  return (
    <div>
      <span>status:{auth.status}</span>
      <span>user:{auth.session?.user.id ?? "none"}</span>
    </div>
  );
}

function renderAuth() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthState />
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe("CMS transient expiry confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    FakeBroadcastChannel.messages = [];
    window.sessionStorage.clear();
    cmsAuthMock.getSession.mockResolvedValue(user);
    cmsAuthMock.getCapabilities.mockResolvedValue({
      role: "editor",
      capabilities: ["dashboard.read", "content.read", "content.write"]
    });
  });

  it("keeps a valid Session after one transient proxy 401", async () => {
    renderAuth();
    await screen.findByText("status:authenticated");
    cmsAuthMock.getSession.mockClear();
    cmsAuthMock.getCapabilities.mockClear();
    cmsAuthMock.getSession.mockRejectedValueOnce(new CmsAuthError(401)).mockResolvedValueOnce(user);

    act(() => notifyCmsSessionExpired());

    await waitFor(() => {
      expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(2);
      expect(cmsAuthMock.getCapabilities).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("user:user-1")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(CMS_SESSION_NOTICE_KEY)).toBeNull();
    expect(FakeBroadcastChannel.messages).toEqual([]);
  });

  it("fails closed after the bounded Session confirmation also returns 401", async () => {
    renderAuth();
    await screen.findByText("status:authenticated");
    cmsAuthMock.getSession.mockClear();
    cmsAuthMock.getCapabilities.mockClear();
    cmsAuthMock.getSession.mockRejectedValueOnce(new CmsAuthError(401)).mockRejectedValueOnce(new CmsAuthError(401));

    act(() => notifyCmsSessionExpired());

    expect(await screen.findByText("status:unauthenticated")).toBeInTheDocument();
    expect(screen.getByText("user:none")).toBeInTheDocument();
    expect(cmsAuthMock.getSession).toHaveBeenCalledTimes(2);
    expect(cmsAuthMock.getCapabilities).not.toHaveBeenCalled();
    expect(FakeBroadcastChannel.messages).toEqual(["logged-out"]);
  });
});
