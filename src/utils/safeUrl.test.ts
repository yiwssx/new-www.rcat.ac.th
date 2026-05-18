import { describe, expect, it } from "vitest";
import { getPublicImageSrcSet, normalizePublicImageUrl, normalizeSafeHref, normalizeSafeResourceUrl } from "./safeUrl";

describe("normalizeSafeHref", () => {
  it("rejects dangerous protocols", () => {
    expect(normalizeSafeHref("javascript:alert(1)")).toBe("#");
    expect(normalizeSafeHref("data:text/html,<script>alert(1)</script>")).toBe("#");
    expect(normalizeSafeHref("vbscript:msgbox(1)")).toBe("#");
    expect(normalizeSafeHref("file:///C:/secret.txt")).toBe("#");
    expect(normalizeSafeHref("blob:https://example.com/id")).toBe("#");
  });

  it("allows safe public link forms", () => {
    expect(normalizeSafeHref("https://example.com")).toBe("https://example.com");
    expect(normalizeSafeHref("/news")).toBe("/news");
    expect(normalizeSafeHref("mailto:test@example.com")).toBe("mailto:test@example.com");
    expect(normalizeSafeHref("tel:+66000000000")).toBe("tel:+66000000000");
    expect(normalizeSafeHref("#calendar")).toBe("#calendar");
  });

  it("rejects unknown protocols and protocol-relative URLs", () => {
    expect(normalizeSafeHref("ftp://example.com/file.txt")).toBe("#");
    expect(normalizeSafeHref("//example.com/path")).toBe("#");
    expect(normalizeSafeHref("news")).toBe("#");
  });

  it("rejects backslash, control characters, and internal whitespace", () => {
    expect(normalizeSafeHref("/\\evil.com")).toBe("#");
    expect(normalizeSafeHref("https://example.com\\@evil.com")).toBe("#");
    expect(normalizeSafeHref("https://example.com/a b")).toBe("#");
    expect(normalizeSafeHref("https://example.com/a\tb")).toBe("#");
    expect(normalizeSafeHref("https://example.com/a\u0000b")).toBe("#");
  });

  it("normalizes image and iframe resource URLs", () => {
    expect(normalizeSafeResourceUrl("https://example.com/image.jpg")).toBe("https://example.com/image.jpg");
    expect(normalizeSafeResourceUrl("/media/image.jpg")).toBe("/media/image.jpg");
    expect(normalizeSafeResourceUrl("http://example.com/image.jpg")).toBe("");
    expect(normalizeSafeResourceUrl("https://example.com\\image.jpg")).toBe("");
    expect(normalizeSafeResourceUrl("javascript:alert(1)")).toBe("");
    expect(normalizeSafeResourceUrl("data:text/html,test")).toBe("");
    expect(normalizeSafeResourceUrl("mailto:test@example.com")).toBe("");
  });
});

describe("normalizePublicImageUrl", () => {
  const driveFileId = "RCAT_intro-2026_ABC123";
  const driveThumbnail = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1600`;

  it("allows stable relative paths and normal HTTPS image URLs", () => {
    expect(normalizePublicImageUrl("/intro/intro-gate-2026.webp")).toBe("/intro/intro-gate-2026.webp");
    expect(normalizePublicImageUrl("https://example-cdn.example.com/intro.webp")).toBe(
      "https://example-cdn.example.com/intro.webp"
    );
  });

  it("normalizes supported Google Drive image URL forms to thumbnail URLs", () => {
    expect(normalizePublicImageUrl(`https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`)).toBe(
      driveThumbnail
    );
    expect(normalizePublicImageUrl(`https://drive.google.com/open?id=${driveFileId}`)).toBe(driveThumbnail);
    expect(normalizePublicImageUrl(`https://drive.google.com/uc?id=${driveFileId}`)).toBe(driveThumbnail);
    expect(normalizePublicImageUrl(`https://drive.google.com/thumbnail?id=${driveFileId}&sz=w400`)).toBe(
      driveThumbnail
    );
  });

  it("builds responsive srcset candidates for supported Google Drive image URLs only", () => {
    expect(getPublicImageSrcSet(`https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`)).toBe(
      [
        `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w640 640w`,
        `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w900 900w`,
        `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1200 1200w`,
        `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1600 1600w`
      ].join(", ")
    );
    expect(getPublicImageSrcSet("/intro/intro-gate-2026.webp")).toBe("");
    expect(getPublicImageSrcSet("https://example-cdn.example.com/intro.webp")).toBe("");
    expect(getPublicImageSrcSet("https://scontent.fkkc3-1.fna.fbcdn.net/v/t39.30808-6/intro-gate.jpg")).toBe("");
  });

  it("rejects unsafe URLs, suspicious Drive IDs, and direct Facebook CDN URLs", () => {
    expect(normalizePublicImageUrl("javascript:alert(1)")).toBe("");
    expect(normalizePublicImageUrl("data:image/png;base64,abc")).toBe("");
    expect(normalizePublicImageUrl("file:///C:/intro.webp")).toBe("");
    expect(normalizePublicImageUrl("//example.com/intro.webp")).toBe("");
    expect(normalizePublicImageUrl("https://example.com/intro gate.webp")).toBe("");
    expect(normalizePublicImageUrl("https://drive.google.com/file/d/unsafe$file/view?usp=sharing")).toBe("");
    expect(normalizePublicImageUrl("https://fbcdn.net/intro-gate.jpg")).toBe("");
    expect(normalizePublicImageUrl("https://scontent.fkkc3-1.fna.fbcdn.net/v/t39.30808-6/intro-gate.jpg")).toBe("");
  });
});
