import { describe, expect, it } from "vitest";
import { normalizeSafeHref } from "./safeUrl";

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
});
