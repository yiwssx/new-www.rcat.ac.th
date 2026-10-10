// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listAdminOrganizationAssignments,
  listAdminOrganizationPositions,
  listAdminOrganizationContentUnits,
  listAdminPersonnel,
  getAdminPersonnelById
} from "../src/db/organizationAdminRepository";
import {
  getAdminOrganizationAssignmentById,
  getAdminOrganizationPositionById
} from "../src/db/organizationDutyRepository";
import { hasAdminCapability } from "../src/auth/adminCapabilities";
import { resolveAdminRoutePolicy } from "../src/auth/adminRoutePolicy";
import { handleAdminOrganizationRead } from "../src/routes/adminOrganization";
import type { Env } from "../src/env";

vi.mock("../src/db/organizationAdminRepository", () => ({
  listAdminOrganizationContentUnits: vi.fn(),
  listAdminPersonnel: vi.fn(),
  listAdminOrganizationPositions: vi.fn(),
  listAdminOrganizationAssignments: vi.fn(),
  getAdminPersonnelById: vi.fn()
}));

vi.mock("../src/db/organizationDutyRepository", () => ({
  getAdminOrganizationPositionById: vi.fn(),
  getAdminOrganizationAssignmentById: vi.fn()
}));

const env = {} as Env;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAdminOrganizationContentUnits).mockResolvedValue([]);
  vi.mocked(listAdminPersonnel).mockResolvedValue([]);
  vi.mocked(listAdminOrganizationPositions).mockResolvedValue([]);
  vi.mocked(listAdminOrganizationAssignments).mockResolvedValue([]);
  vi.mocked(getAdminPersonnelById).mockResolvedValue(null);
  vi.mocked(getAdminOrganizationPositionById).mockResolvedValue(null);
  vi.mocked(getAdminOrganizationAssignmentById).mockResolvedValue(null);
});

describe("Organization Chart Admin read boundary", () => {
  it("requires a distinct capability and restricts confidential reads to editors/admins", () => {
    for (const collection of ["units", "personnel", "positions", "assignments"]) {
      expect(resolveAdminRoutePolicy("GET", ["organization", collection])).toMatchObject({
        matched: true,
        capability: "organization.read"
      });
    }
    expect(hasAdminCapability("admin", "organization.read")).toBe(true);
    expect(hasAdminCapability("editor", "organization.read")).toBe(true);
    expect(hasAdminCapability("viewer", "organization.read")).toBe(false);
    expect(hasAdminCapability("viewer", "organization.manage")).toBe(false);
    expect(resolveAdminRoutePolicy("POST", ["organization", "personnel"])).toMatchObject({
      matched: true,
      capability: "organization.manage"
    });
  });

  it("reads all four collections with bounded pagination and no-store response headers", async () => {
    for (const [collection, read] of [
      ["units", listAdminOrganizationContentUnits],
      ["personnel", listAdminPersonnel],
      ["positions", listAdminOrganizationPositions],
      ["assignments", listAdminOrganizationAssignments]
    ] as const) {
      const req = new Request(`https://example.invalid/api/admin/organization/${collection}?limit=25`);
      const response = await handleAdminOrganizationRead(req, env, ["organization", collection]);
      expect(response?.status).toBe(200);
      expect(response?.headers.get("Cache-Control")).toBe("no-store");
      expect(await response?.json()).toMatchObject({ items: [], maximumItems: 25 });
      expect(read).toHaveBeenCalledWith(env, 25);
    }
  });

  it("rejects oversized, duplicate, malformed, or unexpected query parameters before D1", async () => {
    for (const query of ["?limit=0", "?limit=101", "?limit=-2", "?limit=x", "?limit=1&limit=2", "?sort=id"]) {
      const response = await handleAdminOrganizationRead(
        new Request(`https://example.invalid/api/admin/organization/personnel${query}`),
        env,
        ["organization", "personnel"]
      );
      expect(response?.status).toBe(400);
    }
    expect(listAdminPersonnel).not.toHaveBeenCalled();
  });

  it("reads private detail records only on capability-gated routes and returns no-store", async () => {
    vi.mocked(getAdminPersonnelById).mockResolvedValue({ id: "person-1", display_name: "Staff" } as never);
    const response = await handleAdminOrganizationRead(
      new Request("https://example.invalid/api/admin/organization/personnel/person-1"),
      env,
      ["organization", "personnel", "person-1"]
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(getAdminPersonnelById).toHaveBeenCalledWith(env, "person-1");
    const missing = await handleAdminOrganizationRead(
      new Request("https://example.invalid/api/admin/organization/positions/unknown"),
      env,
      ["organization", "positions", "unknown"]
    );
    expect(missing?.status).toBe(404);
  });

  it("does not support mutation endpoints until audited write handlers are present", async () => {
    const response = await handleAdminOrganizationRead(
      new Request("https://example.invalid/api/admin/organization/personnel", { method: "POST" }),
      env,
      ["organization", "personnel"]
    );
    expect(response?.status).toBe(404);
    expect(listAdminPersonnel).not.toHaveBeenCalled();
  });
});
