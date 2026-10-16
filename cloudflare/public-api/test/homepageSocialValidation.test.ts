// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateAdminLinkWriteRequest } from "../src/adminLinkValidation";

const validWidget = {
  enabled: true,
  pageEmbedEnabled: true,
  pageEmbedHeight: 520,
  links: [{
    id: "dept1", category: "department", label: "เทคโนโลยีธุรกิจดิจิทัล",
    href: "https://www.facebook.com/rcatdigital",
    iconKey: "custom", iconUrl: "https://drive.google.com/thumbnail?id=abc&sz=w256",
    enabled: true
  }]
};

function request(homepageSocial: unknown) {
  return new Request("https://worker.test/api/admin/settings/site", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ homepageSocial })
  });
}

describe("homepage social Worker write-boundary", () => {
  it("accepts a valid custom icon and a link with no icon upload", async () => {
    await expect(validateAdminLinkWriteRequest(request(validWidget))).resolves.toBeUndefined();
    await expect(validateAdminLinkWriteRequest(request({
      ...validWidget, links: [{ ...validWidget.links[0], iconKey: "computer", iconUrl: "" }]
    }))).resolves.toBeUndefined();
  });

  it("rejects unsafe external and uploaded-image URLs", async () => {
    await expect(validateAdminLinkWriteRequest(request({
      ...validWidget, links: [{ ...validWidget.links[0], href: "javascript:alert(1)" }]
    }))).rejects.toThrow();
    await expect(validateAdminLinkWriteRequest(request({
      ...validWidget, links: [{ ...validWidget.links[0], iconUrl: "data:image/svg+xml,unsafe" }]
    }))).rejects.toThrow();
    await expect(validateAdminLinkWriteRequest(request({
      ...validWidget, links: [{ ...validWidget.links[0], iconUrl: "" }]
    }))).rejects.toThrow("missing social icon");
  });

  it("rejects unsupported icon IDs and invalid or duplicate items", async () => {
    await expect(validateAdminLinkWriteRequest(request({
      ...validWidget, links: [{ ...validWidget.links[0], iconKey: "<script>" }]
    }))).rejects.toThrow("invalid social link");
    await expect(validateAdminLinkWriteRequest(request({
      ...validWidget, links: [validWidget.links[0], validWidget.links[0]]
    }))).rejects.toThrow("invalid social link");
  });

  it("checks height and max record count", async () => {
    await expect(validateAdminLinkWriteRequest(request({
      ...validWidget, pageEmbedHeight: 999
    }))).rejects.toThrow("invalid homepage social settings");
    await expect(validateAdminLinkWriteRequest(request({
      ...validWidget, links: Array.from({ length: 101 }, (_, n) => ({
        ...validWidget.links[0], id: String(n)
      }))
    }))).rejects.toThrow("invalid homepage social settings");
  });
});
