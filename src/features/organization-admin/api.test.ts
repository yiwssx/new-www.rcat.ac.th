import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrganizationCollection, updateOrganizationRecord, deleteOrganizationRecord } from "./api";
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
    await expect(getOrganizationCollection("units", 101)).rejects.toThrow();
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
