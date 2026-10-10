import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOrganizationCollection,
  updateOrganizationRecord,
  deleteOrganizationRecord,
  reorderOrganizationRecords
} from "./api";
import { organizationAdminQueryKeys } from "./query";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("../admin-write/cloudflareApi", () => ({
  requestCloudflareAdmin: requestMock
}));

afterEach(() => vi.clearAllMocks());

describe("organization Admin facade", () => {
  it("uses the dedicated organization API instead of generic CMS content", async () => {
    requestMock.mockResolvedValueOnce({ items: [], maximumItems: 25, generatedAt: "" });
    await getOrganizationCollection("units", 25);
    expect(requestMock).toHaveBeenCalledWith("/api/admin/organization/units?limit=25");
    requestMock.mockResolvedValueOnce({ items: [], maximumItems: 25, nextOffset: null, generatedAt: "" });
    await getOrganizationCollection("units", 25, 50);
    expect(requestMock).toHaveBeenCalledWith("/api/admin/organization/units?limit=25&offset=50");
    await expect(getOrganizationCollection("units", 101)).rejects.toThrow();
    requestMock.mockResolvedValueOnce({ items: [], maximumItems: 100, nextOffset: null, generatedAt: "" });
    await getOrganizationCollection("personnel", 100, 100);
    expect(requestMock).toHaveBeenLastCalledWith("/api/admin/organization/personnel?limit=100&offset=100");
    requestMock.mockResolvedValueOnce({ items: [], maximumItems: 100, nextOffset: null, generatedAt: "" });
    await getOrganizationCollection("assignments", 100, 100);
    expect(requestMock).toHaveBeenLastCalledWith("/api/admin/organization/assignments?limit=100&offset=100");
  });

  it("requires exact revisions on mutations and preserves API authentication handling", async () => {
    requestMock.mockResolvedValue({ item: { id: "item-1" } });
    await updateOrganizationRecord("positions", "pos-1", 2, { title: "หัวหน้างาน" });
    expect(requestMock).toHaveBeenCalledWith("/api/admin/organization/positions/pos-1", {
      method: "PATCH",
      headers: { "X-RCAT-Expected-Revision": "2" },
      body: JSON.stringify({ title: "หัวหน้างาน" })
    });
    await deleteOrganizationRecord("personnel", "person-1", 4);
    expect(requestMock).toHaveBeenLastCalledWith("/api/admin/organization/personnel/person-1", {
      method: "DELETE",
      headers: { "X-RCAT-Expected-Revision": "4" }
    });
  });

  it("sends a complete versioned DnD reorder through the secure organization facade", async () => {
    requestMock.mockResolvedValueOnce({ reordered: true, count: 2 });
    const items = [
      { id: "pos-b", revision: 2 },
      { id: "pos-a", revision: 1 }
    ];
    await reorderOrganizationRecords("positions", "division-1", items, "Leadership", 0);
    expect(requestMock).toHaveBeenLastCalledWith("/api/admin/organization/reorder", {
      method: "POST",
      body: JSON.stringify({
        collection: "positions",
        scopeId: "division-1",
        items,
        groupLabel: "Leadership",
        groupSortOrder: 0
      })
    });
  });

  it("rejects unsafe IDs and invalid revisions before a network request", async () => {
    await expect(getOrganizationCollection("units", 0)).rejects.toThrow();
    await expect(deleteOrganizationRecord("units", "../content", 0)).rejects.toThrow("invalid organization record ID");
    await expect(deleteOrganizationRecord("units", "org-1", -1)).rejects.toThrow("valid revision");
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("uses distinct query cache partitions per resource and item", () => {
    expect(organizationAdminQueryKeys.collection("units")).not.toEqual(
      organizationAdminQueryKeys.collection("personnel")
    );
    expect(organizationAdminQueryKeys.detail("units", "org-a")).not.toEqual(
      organizationAdminQueryKeys.detail("units", "org-b")
    );
  });
});
