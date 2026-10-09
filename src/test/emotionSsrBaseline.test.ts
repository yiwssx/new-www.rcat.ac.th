// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderSsrResponse } from "../entry-server";

describe("P07 read-only SSR buffering baseline", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "synthetic upstream unavailable" }, { status: 503 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records the in-process HTML finalization profile for representative routes", async () => {
    for (const path of ["/", "/news", "/documents", "/contact"]) {
      const start = performance.now();
      const heapBefore = process.memoryUsage().heapUsed;
      const response = await renderSsrResponse(new Request(`https://www.rcat.ac.th${path}`));
      const responseReadyMilliseconds = performance.now() - start;
      const html = await response.text();
      const htmlBytes = Buffer.byteLength(html, "utf8");
      const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;

      expect(response.headers.get("content-type")).toContain("text/html");
      expect(htmlBytes).toBeGreaterThan(0);

      // Diagnostic only: these in-process figures do not claim live network TTFB or a production SLA.
      process.stdout.write(
        `[P07 SSR baseline] ${JSON.stringify({
          route: path,
          status: response.status,
          htmlBytes,
          responseReadyMilliseconds: Number(responseReadyMilliseconds.toFixed(1)),
          heapDeltaBytes
        })}\n`
      );
    }
  });
});
