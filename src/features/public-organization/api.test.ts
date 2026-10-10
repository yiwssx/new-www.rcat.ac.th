import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicReadError } from "../public-read/errors";
import { getPublicOrganizationDetail } from "./api";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../public-read/request", () => ({ getPublicJson: requestMock }));
afterEach(() => vi.clearAllMocks());

describe("public Organization permalink facade", () => {
  it("fetches only its namespaced slug and preserves public snapshot", async () => {
    const detail = {
      unit: { contentId: "unit-1", slug: "academic", title: "วิชาการ" },
      ancestors: [],
      units: [],
      positions: [],
      media: []
    };
    requestMock.mockResolvedValueOnce(detail);
    expect(await getPublicOrganizationDetail("academic")).toEqual(detail);
    expect(requestMock).toHaveBeenCalledWith("/api/public/organization/academic", "organization-detail", {});
  });

  it("percent-encodes Thai slugs without changing their meaning", async () => {
    requestMock.mockResolvedValueOnce({
      unit: { contentId: "thai", slug: "งานสารบรรณ", title: "งานสารบรรณ" },
      ancestors: [],
      units: [],
      positions: [],
      media: []
    });
    await getPublicOrganizationDetail("งานสารบรรณ");
    expect(requestMock).toHaveBeenCalledWith(
      `/api/public/organization/${encodeURIComponent("งานสารบรรณ")}`,
      "organization-detail",
      {}
    );
  });

  it("treats unpublished/not-found responses as absent and rejects bad slugs without requesting", async () => {
    requestMock.mockRejectedValueOnce(
      new PublicReadError("not found", { kind: "http", resource: "organization-detail", status: 404 })
    );
    expect(await getPublicOrganizationDetail("private")).toBeNull();
    expect(await getPublicOrganizationDetail("../private")).toBeNull();
    expect(await getPublicOrganizationDetail("foo/bar")).toBeNull();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed for missing projection fields or transient Worker failure", async () => {
    requestMock.mockResolvedValueOnce({ unit: {}, positions: [] });
    await expect(getPublicOrganizationDetail("academic")).rejects.toThrow(/invalid organization detail/);
    requestMock.mockRejectedValueOnce(
      new PublicReadError("unavailable", { kind: "http", resource: "organization-detail", status: 503 })
    );
    await expect(getPublicOrganizationDetail("academic")).rejects.toThrow("unavailable");
  });
});
