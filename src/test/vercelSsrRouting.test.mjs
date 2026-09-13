// @vitest-environment node

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readVercelConfig() {
  const source = await readFile(new URL("../../vercel.json", import.meta.url), "utf8");
  return JSON.parse(source);
}

describe("Vercel SSR cutover routing", () => {
  it("builds a static CSR fallback while reserving the root filesystem path for SSR", async () => {
    const config = await readVercelConfig();

    expect(config.outputDirectory).toBe("dist");
    expect(config.buildCommand).toContain("prepare-ssr-cutover-output.mjs");
    expect(config.functions?.["api/ssr.ts"]?.supportsCancellation).toBe(true);
    expect(config.buildCommand).toContain("vite build --ssr src/vercelSsr.ts");
    expect(config.trailingSlash).toBe(false);
  });

  it("keeps Admin/Auth on CSR and only sends supported public route shapes to SSR", async () => {
    const config = await readVercelConfig();
    const rewrites = config.rewrites || [];
    const destinationFor = (source) => rewrites.find((rewrite) => rewrite.source === source)?.destination;

    expect(destinationFor("/login")).toBe("/csr.html");
    expect(destinationFor("/activate-account")).toBe("/csr.html");
    expect(destinationFor("/reset-password")).toBe("/csr.html");
    expect(destinationFor("/admin")).toBe("/csr.html");
    expect(destinationFor("/admin/:path*")).toBe("/csr.html");

    expect(destinationFor("/")).toBe("/api/ssr?_rcatPath=/");
    expect(destinationFor("/news")).toBe("/api/ssr?_rcatPath=/news");
    expect(destinationFor("/complaint")).toBe("/api/ssr?_rcatPath=/complaint");
    expect(destinationFor("/ita2569")).toBe("/api/ssr?_rcatPath=/ita2569");
    expect(destinationFor("/content/:slug")).toBe("/api/ssr?_rcatPath=/content/:slug");
    expect(destinationFor("/:slug")).toBe("/api/ssr?_rcatPath=/:slug");

    expect(destinationFor("/(.*)")).toBeUndefined();
    expect(rewrites.at(-1)?.source).toBe("/:slug");
  });

  it("canonicalizes common legacy entry paths before they can reach SSR", async () => {
    const config = await readVercelConfig();
    const redirects = config.redirects || [];

    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/home", destination: "/", permanent: true },
        { source: "/index", destination: "/", permanent: true },
        { source: "/index.html", destination: "/", permanent: true }
      ])
    );
  });

  it("protects the CSR fallback while caching hashed client assets immutably", async () => {
    const config = await readVercelConfig();
    const headers = config.headers || [];
    const rulesFor = (source) => headers.find((rule) => rule.source === source)?.headers || [];
    const headerValue = (source, key) => rulesFor(source).find((header) => header.key === key)?.value;

    expect(headerValue("/csr.html", "Cache-Control")).toBe("no-store");
    expect(headerValue("/csr.html", "X-Robots-Tag")).toBe("noindex, nofollow");
    expect(headerValue("/assets/:path*", "Cache-Control")).toBe("public, max-age=31536000, immutable");
  });
});
