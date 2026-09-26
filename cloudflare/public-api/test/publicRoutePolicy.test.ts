import { describe, expect, it } from "vitest";
import { RESERVED_PUBLIC_ROOT_SLUGS, isReservedPublicContentSlug } from "../src/publicRoutePolicy";

describe("publicRoutePolicy", () => {
  it("reserves registered public application and core route roots", () => {
    expect(isReservedPublicContentSlug("news")).toBe(true);
    expect(isReservedPublicContentSlug("complaint")).toBe(true);
    expect(isReservedPublicContentSlug("ita2569")).toBe(true);
    expect(isReservedPublicContentSlug("/departments/example")).toBe(true);
  });

  it("reserves system-owned route roots", () => {
    expect(isReservedPublicContentSlug("admin")).toBe(true);
    expect(isReservedPublicContentSlug("api/example")).toBe(true);
    expect(isReservedPublicContentSlug("content/example")).toBe(true);
    expect(RESERVED_PUBLIC_ROOT_SLUGS).toContain("login");
  });

  it("allows unrelated CMS slugs", () => {
    expect(isReservedPublicContentSlug("admission")).toBe(false);
    expect(isReservedPublicContentSlug("about-college")).toBe(false);
  });
});
