// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getCanonicalProductionRedirect } from "../../middleware";

describe("Vercel production canonical redirect", () => {
  it("redirects production deployment hosts to the canonical domain", () => {
    const redirect = getCanonicalProductionRedirect(
      "https://new-wwwrcatac-216tvtmj3-rcat-it-dev-team.vercel.app/news?page=2",
      "production"
    );

    expect(redirect?.toString()).toBe("https://www.rcat.ac.th/news?page=2");
  });

  it("preserves the root path on production deployment hosts", () => {
    const redirect = getCanonicalProductionRedirect(
      "https://new-wwwrcatac-216tvtmj3-rcat-it-dev-team.vercel.app/",
      "production"
    );

    expect(redirect?.toString()).toBe("https://www.rcat.ac.th/");
  });

  it("does not redirect preview deployment hosts", () => {
    expect(
      getCanonicalProductionRedirect(
        "https://new-wwwrcatac-feature-ui-rcat-it-dev-team.vercel.app/admin/content",
        "preview"
      )
    ).toBeNull();
  });

  it("does not redirect the canonical production domain", () => {
    expect(getCanonicalProductionRedirect("https://www.rcat.ac.th/news", "production")).toBeNull();
  });

  it("does not redirect other custom domains in production", () => {
    expect(getCanonicalProductionRedirect("https://rcat.ac.th/news", "production")).toBeNull();
  });

  it("does not redirect development requests", () => {
    expect(getCanonicalProductionRedirect("http://localhost:5173/news", "development")).toBeNull();
  });
});
