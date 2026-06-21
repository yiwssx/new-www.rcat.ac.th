// @vitest-environment node

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { handleAppsScriptProxyRequest } from "./handler.mjs";

function createRequest({ body, headers = {}, method = "POST" } = {}) {
  const request = Readable.from(body === undefined ? [] : [typeof body === "string" ? body : JSON.stringify(body)]);
  request.method = method;
  request.headers = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return request;
}

function createResponse() {
  const headers = new Map();
  let body = "";

  return {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end(value) {
      body = value === undefined ? "" : String(value);
    },
    get bodyJson() {
      return JSON.parse(body);
    }
  };
}

function createEnv() {
  return {
    GOOGLE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/test-deployment/exec"
  };
}

describe("Vercel Apps Script media proxy", () => {
  it("rejects resources outside the explicit media allowlist", async () => {
    const fetchImpl = vi.fn();
    const response = createResponse();

    await handleAppsScriptProxyRequest(
      createRequest({ body: { resource: "users", payload: { action: "list" } } }),
      response,
      { env: createEnv(), fetchImpl }
    );

    expect(response.statusCode).toBe(400);
    expect(response.getHeader("cache-control")).toBe("no-store");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("forwards the unchanged media payload as text to Apps Script", async () => {
    const payload = {
      name: "original.png",
      size: "10 MB",
      fileBase64: "AAECAwQFBgcICQ=="
    };
    const upstreamResult = { id: "drive-media-1", ...payload };
    const fetchImpl = vi.fn(async () => Response.json(upstreamResult));
    const response = createResponse();

    await handleAppsScriptProxyRequest(createRequest({ body: { resource: "media", payload } }), response, {
      env: createEnv(),
      fetchImpl
    });

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson).toEqual(upstreamResult);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBeInstanceOf(URL);
    expect(url.toString()).toContain("resource=media");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  });

  it("maps deleteMedia to the Apps Script media-delete resource", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: "drive-media-1", deleted: true }));
    const response = createResponse();

    await handleAppsScriptProxyRequest(
      createRequest({ body: { resource: "deleteMedia", payload: { id: "drive-media-1" } } }),
      response,
      { env: createEnv(), fetchImpl }
    );

    expect(fetchImpl.mock.calls[0][0].toString()).toContain("resource=media-delete");
  });

  it("returns 502 when Apps Script returns a non-success response", async () => {
    const response = createResponse();

    await handleAppsScriptProxyRequest(
      createRequest({ body: { resource: "media", payload: { name: "original.png" } } }),
      response,
      { env: createEnv(), fetchImpl: vi.fn(async () => new Response("failed", { status: 404 })) }
    );

    expect(response.statusCode).toBe(502);
    expect(response.bodyJson).toEqual({ error: "Apps Script bridge failed" });
  });

  it("returns 503 without exposing details when the server Apps Script URL is missing", async () => {
    const response = createResponse();

    await handleAppsScriptProxyRequest(
      createRequest({ body: { resource: "media", payload: { name: "original.png" } } }),
      response,
      { env: {}, fetchImpl: vi.fn() }
    );

    expect(response.statusCode).toBe(503);
    expect(response.bodyJson).toEqual({ error: "Apps Script URL is not configured" });
  });
});
