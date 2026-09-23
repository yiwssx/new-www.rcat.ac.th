// @vitest-environment node
import { describe, expect, it } from "vitest";
import { routeRequest } from "../src/router";

function emptyD1() {
  const db = {
    prepare() {
      const statement = {
        bind() {
          return statement;
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { meta: { changes: 0 } };
        }
      };
      return statement;
    }
  };
  return db as unknown as D1Database;
}

describe("editorial governance router boundary", () => {
  it("does not expose trash without the existing admin authentication boundary", async () => {
    const response = await routeRequest(new Request("https://worker.example.test/api/admin/content/trash"), {
      DB: emptyD1(),
      CMS_AUTH_PROXY_SECRET: "test-only-proxy-secret-repeated-000000000000"
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not expose workflow mutation without the existing admin authentication boundary", async () => {
    const response = await routeRequest(
      new Request("https://worker.example.test/api/admin/content/content-1/workflow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "review" })
      }),
      {
        DB: emptyD1(),
        CMS_AUTH_PROXY_SECRET: "test-only-proxy-secret-repeated-000000000000"
      }
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
