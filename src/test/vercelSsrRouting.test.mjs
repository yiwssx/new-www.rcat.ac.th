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
  });

  it("keeps Admin/Auth on the CSR fallback and sends the remaining application paths to SSR", async () => {
    const config = await readVercelConfig();
    const rewrites = config.rewrites || [];
    const destinationFor = (source) => rewrites.find((rewrite) => rewrite.source === source)?.destination;

    expect(destinationFor("/login")).toBe("/csr.html");
    expect(destinationFor("/activate-account")).toBe("/csr.html");
    expect(destinationFor("/reset-password")).toBe("/csr.html");
    expect(destinationFor("/admin")).toBe("/csr.html");
    expect(destinationFor("/admin/:path*")).toBe("/csr.html");
    expect(destinationFor("/(.*)")).toBe("/api/ssr?_rcatPath=/$1");
    expect(rewrites.at(-1)?.source).toBe("/(.*)");
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
