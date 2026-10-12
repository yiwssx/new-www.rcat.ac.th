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
import { searchAdminOrganizationPage } from "../src/db/organizationSearchRepository";
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

vi.mock("../src/db/organizationSearchRepository", () => ({
  searchAdminOrganizationPage: vi.fn()
}));

const env = {} as Env;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAdminOrganizationContentUnits).mockResolvedValue([]);
  vi.mocked(searchAdminOrganizationPage).mockResolvedValue({ items: [], total: 0 });
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
      expect(read).toHaveBeenCalledWith(env, 25, 0);
    }
  });

  it("rejects oversized, duplicate, malformed, or unexpected query parameters before D1", async () => {
    for (const query of [
      "?limit=0",
      "?limit=101",
      "?limit=-2",
      "?limit=x",
      "?limit=1&limit=2",
      "?sort=id",
      "?offset=-1"
    ]) {
      const response = await handleAdminOrganizationRead(
        new Request(`https://example.invalid/api/admin/organization/personnel${query}`),
        env,
        ["organization", "personnel"]
      );
      expect(response?.status).toBe(400);
    }
    expect(listAdminPersonnel).not.toHaveBeenCalled();
  });

  it("queries server-side personnel search and counts without loading every page", async () => {
    vi.mocked(searchAdminOrganizationPage).mockResolvedValueOnce({
      items: [{ id: "person-145", display_name: "ผลค้นหา" }],
      total: 145
    });
    const response = await handleAdminOrganizationRead(
      new Request(
        "https://example.invalid/api/admin/organization/personnel?limit=1&offset=3&search=%E0%B8%84%E0%B8%A3%E0%B8%B9&includeTotal=1"
      ),
      env,
      ["organization", "personnel"]
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(await response?.json()).toMatchObject({ total: 145, nextOffset: 4, maximumItems: 1 });
    expect(searchAdminOrganizationPage).toHaveBeenCalledWith(env, "personnel", {
      limit: 1,
      offset: 3,
      search: "ครู",
      unitContentId: undefined,
      positionId: undefined
    });
    expect(listAdminPersonnel).not.toHaveBeenCalled();
  });

  it("bounds unit-scoped searches and rejects filter misuse", async () => {
    const scoped = await handleAdminOrganizationRead(
      new Request("https://example.invalid/api/admin/organization/positions?unitContentId=unit-1&limit=10"),
      env,
      ["organization", "positions"]
    );
    expect(scoped?.status).toBe(200);
    expect(searchAdminOrganizationPage).toHaveBeenCalledWith(
      env,
      "positions",
      expect.objectContaining({ unitContentId: "unit-1", limit: 10 })
    );
    for (const query of ["?search=x&search=y", "?includeTotal=x", "?unitContentId=%2Fbad", "?positionId=person-1"]) {
      const response = await handleAdminOrganizationRead(
        new Request("https://example.invalid/api/admin/organization/units" + query),
        env,
        ["organization", "units"]
      );
      expect(response?.status).toBe(400);
    }
  });

  it("supports offset paging for a reusable personnel directory without leaking other collections", async () => {
    vi.mocked(listAdminPersonnel).mockResolvedValueOnce([{ id: "person-002" }, { id: "person-003" }] as never);
    const response = await handleAdminOrganizationRead(
      new Request("https://example.invalid/api/admin/organization/personnel?limit=2&offset=2"),
      env,
      ["organization", "personnel"]
    );
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ maximumItems: 2, nextOffset: 4 });
    expect(listAdminPersonnel).toHaveBeenCalledWith(env, 2, 2);
    vi.mocked(listAdminOrganizationAssignments).mockResolvedValueOnce([{ id: "assignment-2" }] as never);
    const assignmentsPage = await handleAdminOrganizationRead(
      new Request("https://example.invalid/api/admin/organization/assignments?limit=1&offset=1"),
      env,
      ["organization", "assignments"]
    );
    expect(assignmentsPage?.status).toBe(200);
    expect(await assignmentsPage?.json()).toMatchObject({ nextOffset: 2 });
    expect(listAdminOrganizationAssignments).toHaveBeenCalledWith(env, 1, 1);
  });

  it("bounds unit pagination and emits nextOffset only for a full page", async () => {
    vi.mocked(listAdminOrganizationContentUnits).mockResolvedValueOnce(
      Array.from({ length: 2 }, (_, index) => ({ content_id: `org-${index}` })) as never
    );
    const response = await handleAdminOrganizationRead(
      new Request("https://example.invalid/api/admin/organization/units?limit=2&offset=4"),
      env,
      ["organization", "units"]
    );
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ nextOffset: 6, maximumItems: 2 });
    expect(listAdminOrganizationContentUnits).toHaveBeenCalledWith(env, 2, 4);
    const bad = await handleAdminOrganizationRead(
      new Request("https://example.invalid/api/admin/organization/units?offset=-1"),
      env,
      ["organization", "units"]
    );
    expect(bad?.status).toBe(400);
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
