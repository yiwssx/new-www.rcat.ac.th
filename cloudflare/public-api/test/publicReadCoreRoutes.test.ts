import { describe, expect, it } from "vitest";
import m17Doc from "../../../docs/architecture/m17-cloudflare-core-public-read-batch-2026-06-13.md?raw";
import worker from "../src/index";
import { PUBLIC_READ_ROUTE_REGISTRY } from "../src/routes/publicReadRegistry";

const expectedSkeletonRoutes = [
  {
    path: "/api/public/home",
    resource: "public-home"
  },
  {
    path: "/api/public/content",
    resource: "content-list"
  },
  {
    path: "/api/public/content/sample-slug",
    resource: "content-detail"
  },
  {
    path: "/api/public/search",
    resource: "search"
  },
  {
    path: "/api/public/programs",
    resource: "program"
  },
  {
    path: "/api/public/visitor-stats",
    resource: "visitor-stats"
  }
] as const;

async function readTextAndJson(response: Response) {
  const text = await response.text();

  return {
    text,
    payload: JSON.parse(text) as Record<string, unknown>
  };
}

describe("M17 Cloudflare Core public read routes", () => {
  it("documents the M17 public read batch without production endpoint evidence", () => {
    expect(m17Doc).toMatch(/Cloudflare Core Public Read API/i);
    expect(m17Doc).toMatch(/M15\.2 real execute cutover remains deferred/i);
    expect(m17Doc).toMatch(/dev\/preview Worker origins/i);
    expect(m17Doc).toMatch(/Apps Script fallback remains available/i);
    expect(m17Doc).toMatch(/M18: Admin \+ D1 Write Batch Migration/i);
    expect(m17Doc).not.toMatch(/script\.google\.com|drive\.google\.com|rcat\.ac\.th/i);
    expect(m17Doc).not.toMatch(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  });

  it("registers the grouped public read route plan without marking skeletons implemented", () => {
    expect(PUBLIC_READ_ROUTE_REGISTRY.map((route) => route.resource)).toEqual([
      "public-document-list",
      "public-home",
      "content-list",
      "content-detail",
      "search",
      "program",
      "visitor-stats"
    ]);
    expect(PUBLIC_READ_ROUTE_REGISTRY.find((route) => route.resource === "public-document-list")).toMatchObject({
      implemented: true,
      method: "GET",
      pathPattern: "/api/public/documents"
    });
    expect(PUBLIC_READ_ROUTE_REGISTRY.filter((route) => !route.implemented).map((route) => route.resource)).toEqual([
      "public-home",
      "content-list",
      "content-detail",
      "search",
      "program",
      "visitor-stats"
    ]);
  });

  it.each(expectedSkeletonRoutes)(
    "returns a safe M17 not-implemented response for $path",
    async ({ path, resource }) => {
      const response = await worker.fetch(new Request(`https://public-api.example.test${path}`), {});
      const { payload, text } = await readTextAndJson(response);

      expect(response.status).toBe(501);
      expect(payload).toEqual({
        error: "Not implemented",
        resource,
        phase: "M17"
      });
      expect(text).not.toMatch(
        /stack|SQL|SELECT|D1|file_url|body_doc_url|drive_url|script\.google\.com|drive\.google\.com|rcat\.ac\.th/i
      );
    }
  );

  it("keeps OPTIONS safe for new public read routes", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/home", {
        method: "OPTIONS"
      }),
      {}
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });

  it("allows only GET and OPTIONS for the public read route foundation", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/home", {
        method: "POST"
      }),
      {}
    );
    const { payload } = await readTextAndJson(response);

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, OPTIONS");
    expect(payload).toEqual({
      error: "method not allowed"
    });
  });
});
