// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_NOT_FOUND_CDN_CACHE_CONTROL, renderVercelPublicSsrRequest } from "../vercelSsr";

describe("Vercel legacy permalink guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects non-canonical scanner-style slugs before calling the public content API", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("public API should not be called for a rejected legacy slug");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const response = await renderVercelPublicSsrRequest(
      new Request("https://www.rcat.ac.th/api/ssr?_rcatPath=/WP-LOGIN")
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(PUBLIC_NOT_FOUND_CDN_CACHE_CONTROL);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
