import { describe, expect, it } from "vitest";
import worker from "../src/index";

const localEnv = {};

async function getJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("rcat public API Worker M1 skeleton", () => {
  it("returns the M1 service health payload from /health", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/health"), localEnv);
    const payload = await getJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      service: "rcat-public-api",
      version: "m1-skeleton"
    });
    expect(new Date(String(payload.timestamp)).toISOString()).toBe(payload.timestamp);
  });

  it("returns the M1 service health payload from /api/health", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/health"), localEnv);
    const payload = await getJson(response);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
  });

  it("returns an explicit 501 skeleton response for public documents", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), localEnv);

    expect(response.status).toBe(501);
    await expect(getJson(response)).resolves.toEqual({
      error: "public-document-list is not implemented in M1 skeleton",
      resource: "public-document-list",
      phase: "M1"
    });
  });

  it("returns GET-only CORS headers for OPTIONS requests", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/documents", {
        method: "OPTIONS"
      }),
      localEnv
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });

  it("echoes a configured allowed origin and varies the response by origin", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/health", {
        headers: {
          Origin: "https://www.rcat.ac.th"
        }
      }),
      {
        PUBLIC_API_ALLOWED_ORIGINS: "https://preview.rcat.ac.th, https://www.rcat.ac.th"
      }
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://www.rcat.ac.th");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("does not add a wildcard fallback for an untrusted configured origin", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/health", {
        headers: {
          Origin: "https://untrusted.example.test"
        }
      }),
      {
        PUBLIC_API_ALLOWED_ORIGINS: "https://www.rcat.ac.th"
      }
    );

    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("returns 404 for an unknown route", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/missing"), localEnv);

    expect(response.status).toBe(404);
  });

  it("returns 405 for unsupported methods", async () => {
    const response = await worker.fetch(
      new Request("https://public-api.example.test/api/public/documents", {
        method: "POST"
      }),
      localEnv
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, OPTIONS");
  });
});
