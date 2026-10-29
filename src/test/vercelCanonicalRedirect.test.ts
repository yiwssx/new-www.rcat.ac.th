// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createCanonicalRedirectResponse, getCanonicalProductionRedirect } from "../../middleware";

describe("Vercel production canonical redirect", () => {
  it("constructs an uncached 308 with immutable-compatible headers (no runtime throw)", () => {
    const redirect = getCanonicalProductionRedirect(
      "https://new-wwwrcatacth-rcat-it-dev-team.vercel.app/news?page=2",
      "production"
    );
    expect(redirect).not.toBeNull();
    const response = createCanonicalRedirectResponse(redirect!);
    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe("https://www.rcat.ac.th/news?page=2");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("X-RCAT-Origin-Bridge");
  });

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

  it("accepts explicitly marked Gateway requests on the exact HTTPS Vercel project alias", () => {
    for (const path of ["/", "/news?page=2", "/api/public/home", "/api/cms-auth/session", "/admin"]) {
      expect(
        getCanonicalProductionRedirect(
          "https://new-wwwrcatacth-rcat-it-dev-team.vercel.app" + path,
          "production",
          "rcat-origin-v1"
        )
      ).toBeNull();
    }
  });

  it("keeps 308 canonical redirect for ordinary visitors to the project alias", () => {
    for (const marker of [undefined, null, "", "invalid", "rcat-origin-v2"]) {
      expect(
        getCanonicalProductionRedirect(
          "https://new-wwwrcatacth-rcat-it-dev-team.vercel.app/news?page=2",
          "production",
          marker
        )?.toString()
      ).toBe("https://www.rcat.ac.th/news?page=2");
    }
  });

  it("does not exempt arbitrary Vercel deployment hosts or non-HTTPS origin traffic", () => {
    expect(
      getCanonicalProductionRedirect(
        "https://new-wwwrcatac-216tvtmj3-rcat-it-dev-team.vercel.app/news",
        "production",
        "rcat-origin-v1"
      )?.toString()
    ).toBe("https://www.rcat.ac.th/news");
    expect(
      getCanonicalProductionRedirect(
        "http://new-wwwrcatacth-rcat-it-dev-team.vercel.app/news",
        "production",
        "rcat-origin-v1"
      )?.toString()
    ).toBe("https://www.rcat.ac.th/news");
    expect(
      getCanonicalProductionRedirect(
        "https://new-wwwrcatacth-rcat-it-dev-team.vercel.app.evil.example/news",
        "production",
        "rcat-origin-v1"
      )
    ).toBeNull();
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
