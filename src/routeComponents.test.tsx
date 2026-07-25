import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CmsCapability, CmsRole } from "./features/cms-auth";
import { CapabilityGuard } from "./routeComponents";

const authMock = vi.hoisted(() => ({
  capabilities: [] as CmsCapability[],
  role: "viewer" as CmsRole
}));

vi.mock("./context/authSessionContext", () => ({
  useAuth: () => ({
    status: "authenticated",
    session: { user: { role: authMock.role } },
    capabilities: authMock.capabilities
  })
}));

describe("CMS capability routing", () => {
  beforeEach(() => {
    authMock.capabilities = [];
  });

  it.each(["editor", "viewer"] as const)("does not let a %s reach the all-users view", (role) => {
    authMock.role = role;
    render(
      <CapabilityGuard capability="users.read-all">
        <div>all users content</div>
      </CapabilityGuard>
    );

    expect(screen.queryByText("all users content")).not.toBeInTheDocument();
    expect(screen.getByText("ไม่มีสิทธิ์เข้าถึง")).toBeInTheDocument();
  });
});
