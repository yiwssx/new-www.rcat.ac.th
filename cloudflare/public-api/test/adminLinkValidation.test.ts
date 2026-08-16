// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isValidCmsLink, validateAdminLinkWriteRequest } from "../src/adminLinkValidation";

describe("P5H CMS link policy", () => {
  it("accepts intentional navigation targets", () => {
    expect(isValidCmsLink("/news", "navigation")).toBe(true);
    expect(isValidCmsLink("#contact", "navigation")).toBe(true);
    expect(isValidCmsLink("https://www.rcat.ac.th/news", "navigation")).toBe(true);
    expect(isValidCmsLink("mailto:admin@example.test", "navigation")).toBe(true);
    expect(isValidCmsLink("tel:+6643519000", "navigation")).toBe(true);
  });

  it("rejects unsafe or ambiguous navigation targets", () => {
    expect(isValidCmsLink("//evil.example", "navigation")).toBe(false);
    expect(isValidCmsLink("javascript:alert(1)", "navigation")).toBe(false);
    expect(isValidCmsLink("data:text/html,boom", "navigation")).toBe(false);
    expect(isValidCmsLink("https://example.test/path with space", "navigation")).toBe(false);
    expect(isValidCmsLink("https:\\evil.example", "navigation")).toBe(false);
    expect(isValidCmsLink("https://user:password@example.test/", "navigation")).toBe(false);
  });

  it("keeps resource and canonical policies narrower than navigation", () => {
    expect(isValidCmsLink("/assets/logo.png", "resource")).toBe(true);
    expect(isValidCmsLink("https://drive.google.com/file/d/example/view", "resource")).toBe(true);
    expect(isValidCmsLink("http://files.example.test/document.pdf", "resource")).toBe(false);
    expect(isValidCmsLink("mailto:admin@example.test", "resource")).toBe(false);
    expect(isValidCmsLink("#image", "resource")).toBe(false);

    expect(isValidCmsLink("https://www.rcat.ac.th/news/example", "canonical")).toBe(true);
    expect(isValidCmsLink("http://example.test/news/example", "canonical")).toBe(true);
    expect(isValidCmsLink("/news/example", "canonical")).toBe(false);
  });
});

describe("P5H Admin write-boundary validation", () => {
  it("rejects unsafe content and document URLs before a write handler consumes the body", async () => {
    const contentRequest = new Request("https://worker.test/api/admin/content/content-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonicalUrl: "javascript:alert(1)" })
    });
    await expect(validateAdminLinkWriteRequest(contentRequest)).rejects.toThrow("invalid content canonical URL");

    const documentRequest = new Request("https://worker.test/api/admin/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl: "data:text/plain,not-a-document-link" })
    });
    await expect(validateAdminLinkWriteRequest(documentRequest)).rejects.toThrow("invalid document file URL");
  });

  it("validates nested menu and site-settings links", async () => {
    const menuRequest = new Request("https://worker.test/api/admin/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            label: "Parent",
            href: "/about",
            children: [{ label: "Unsafe", href: "javascript:alert(1)" }]
          }
        ]
      })
    });
    await expect(validateAdminLinkWriteRequest(menuRequest)).rejects.toThrow("invalid menu href");

    const settingsRequest = new Request("https://worker.test/api/admin/settings/site", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        footerDirectoryGroups: [
          {
            title: "Links",
            links: [{ label: "Unsafe", href: "//evil.example" }]
          }
        ]
      })
    });
    await expect(validateAdminLinkWriteRequest(settingsRequest)).rejects.toThrow("invalid site footer link href");
  });

  it("accepts supported external-service batches and media resource URLs", async () => {
    const externalServicesRequest = new Request("https://worker.test/api/admin/external-services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { title: "Admissions", href: "https://admission.example.test" },
          { title: "Contact", href: "tel:+6643519000" },
          { title: "News", href: "/news" }
        ]
      })
    });
    await expect(validateAdminLinkWriteRequest(externalServicesRequest)).resolves.toBeUndefined();

    const mediaRequest = new Request("https://worker.test/api/admin/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driveUrl: "https://drive.google.com/file/d/example/view",
        previewUrl: "https://drive.google.com/thumbnail?id=example",
        embedUrl: "https://drive.google.com/file/d/example/preview",
        thumbnailUrl: "/media/example-thumbnail.jpg"
      })
    });
    await expect(validateAdminLinkWriteRequest(mediaRequest)).resolves.toBeUndefined();
  });

  it("does not take ownership of malformed JSON or order-only payloads", async () => {
    const malformed = new Request("https://worker.test/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{"
    });
    await expect(validateAdminLinkWriteRequest(malformed)).resolves.toBeUndefined();

    const orderRequest = new Request("https://worker.test/api/admin/menu/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: "menu-1", order: 1, revision: 2 }] })
    });
    await expect(validateAdminLinkWriteRequest(orderRequest)).resolves.toBeUndefined();
  });
});
