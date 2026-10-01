// @vitest-environment node

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { getCmsCsrfCookieName, getCmsSessionCookieName } from "../cmsAuth/cookies.mjs";
import { CMS_BROWSER_CSRF_HEADER } from "../cmsAuth/handlers.mjs";
import { handleAppsScriptProxyRequest } from "./handler.mjs";

const SESSION = "A".repeat(43);
const CSRF = "B".repeat(43);
const PROXY_SECRET = "C".repeat(40);
const BRIDGE_TOKEN = "fake-apps-script-bridge-token";
const WORKER_ORIGIN = "https://worker.example.test";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/test-deployment/exec";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=thumbnail-test";
const CHUNK_SIZE = 6 * 256 * 1024;

function createRequest(body) {
  const request = Readable.from([JSON.stringify(body)]);
  request.method = "POST";
  request.headers = Object.fromEntries(
    Object.entries({
      cookie: `${getCmsSessionCookieName()}=${SESSION}; ${getCmsCsrfCookieName()}=${CSRF}`,
      [CMS_BROWSER_CSRF_HEADER]: CSRF
    }).map(([name, value]) => [name.toLowerCase(), value])
  );
  return request;
}

function createResponse() {
  let body = "";
  return {
    statusCode: 200,
    setHeader() {},
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
    APPS_SCRIPT_BRIDGE_TOKEN: BRIDGE_TOKEN,
    CLOUDFLARE_ADMIN_API_URL: WORKER_ORIGIN,
    CMS_AUTH_PROXY_SECRET: PROXY_SECRET,
    GOOGLE_APPS_SCRIPT_URL: APPS_SCRIPT_URL
  };
}

function authorizationSuccess() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

function completedAsset(id, fileId = "file-id") {
  return {
    id,
    name: "Facebook - ข่าวทดสอบ",
    type: "image",
    size: "4 B",
    owner: "Admin",
    driveUrl: `https://drive.google.com/file/d/${fileId}/view`,
    fileId,
    mimeType: "image/jpeg",
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
    previewUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
    embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
    updatedAt: "2026-08-30T00:00:00.000Z"
  };
}

async function callFacebookThumbnail(
  fetchImpl,
  sourceUrl = "https://www.facebook.com/example/posts/123",
  bridgeDelayImpl = async () => undefined
) {
  const response = createResponse();
  await handleAppsScriptProxyRequest(
    createRequest({
      resource: "facebookThumbnail",
      payload: {
        sourceUrl,
        name: "Facebook - ข่าวทดสอบ",
        owner: "Admin"
      }
    }),
    response,
    { env: createEnv(), fetchImpl, bridgeDelayImpl }
  );
  return response;
}

function resourceFromUrl(value) {
  return new URL(String(value)).searchParams.get("resource");
}

describe("Facebook thumbnail media ingestion", () => {
  it("copies a public Facebook preview image through the resumable Apps Script media bridge", async () => {
    const imageUrl = "https://scontent.fbcdn.net/v/t39.30808-6/example.jpg?x=1&amp;y=2";
    const expectedImageUrl = imageUrl.replace("&amp;", "&");
    let deterministicId = "";

    const fetchImpl = vi.fn(async (url, init = {}) => {
      const value = String(url);
      if (value === `${WORKER_ORIGIN}/api/admin/media-bridge-authorization`) {
        return authorizationSuccess();
      }
      if (value.startsWith("https://www.facebook.com/example/posts/123")) {
        return new Response(`<html><head><meta property="og:image" content="${imageUrl}"></head></html>`);
      }
      if (value === expectedImageUrl) {
        return new Response(Uint8Array.from([1, 2, 3, 4]), { headers: { "Content-Type": "image/jpeg" } });
      }
      if (value.startsWith(APPS_SCRIPT_URL)) {
        const resource = resourceFromUrl(value);
        const payload = JSON.parse(init.body);
        deterministicId ||= payload.id;
        expect(payload.id).toBe(deterministicId);
        expect(payload.uploadKey).toBe(deterministicId);
        expect(payload.appsScriptBridgeToken).toBe(BRIDGE_TOKEN);

        if (resource === "media-upload-start") {
          return Response.json({
            uploadComplete: false,
            uploadUrl: UPLOAD_URL,
            totalBytes: 4,
            chunkSizeBytes: CHUNK_SIZE,
            nextByte: 0,
            statusCode: 200
          });
        }
        if (resource === "media-upload-chunk") {
          expect(payload.chunkBase64).toBe("AQIDBA==");
          expect(payload.startByte).toBe(0);
          expect(payload.endByte).toBe(3);
          return Response.json({ uploadComplete: true, asset: completedAsset(deterministicId), statusCode: 200 });
        }
      }
      throw new Error(`Unexpected URL: ${value}`);
    });

    const response = await callFacebookThumbnail(fetchImpl);

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson.id).toMatch(/^facebook-thumbnail-[a-f0-9]{24}$/);
    expect(response.bodyJson.type).toBe("image");
    expect(response.bodyJson.driveUrl).toContain("drive.google.com");
    expect(
      fetchImpl.mock.calls
        .filter(([url]) => String(url).startsWith(APPS_SCRIPT_URL))
        .map(([url]) => resourceFromUrl(url))
    ).toEqual(["media-upload-start", "media-upload-chunk"]);
  });

  it("recovers an ambiguous transient chunk failure through upload status without resending the chunk", async () => {
    const imageUrl = "https://scontent.fbcdn.net/v/t39.30808-6/recovered.jpg";
    let deterministicId = "";
    let chunkCalls = 0;

    const fetchImpl = vi.fn(async (url, init = {}) => {
      const value = String(url);
      if (value === `${WORKER_ORIGIN}/api/admin/media-bridge-authorization`) {
        return authorizationSuccess();
      }
      if (value.startsWith("https://www.facebook.com/example/posts/123")) {
        return new Response(`<meta property="og:image" content="${imageUrl}">`);
      }
      if (value === imageUrl) {
        return new Response(Uint8Array.from([1, 2, 3, 4]), { headers: { "Content-Type": "image/jpeg" } });
      }
      if (value.startsWith(APPS_SCRIPT_URL)) {
        const resource = resourceFromUrl(value);
        const payload = JSON.parse(init.body);
        deterministicId ||= payload.id;
        if (resource === "media-upload-start") {
          return Response.json({
            uploadComplete: false,
            uploadUrl: UPLOAD_URL,
            totalBytes: 4,
            chunkSizeBytes: CHUNK_SIZE,
            nextByte: 0,
            statusCode: 200
          });
        }
        if (resource === "media-upload-chunk") {
          chunkCalls += 1;
          return new Response("temporary upstream failure", { status: 502 });
        }
        if (resource === "media-upload-status") {
          return Response.json({ uploadComplete: true, asset: completedAsset(deterministicId), statusCode: 200 });
        }
      }
      throw new Error(`Unexpected URL: ${value}`);
    });

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await callFacebookThumbnail(fetchImpl);

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson.id).toBe(deterministicId);
    expect(chunkCalls).toBe(1);
    expect(
      fetchImpl.mock.calls
        .filter(([url]) => String(url).startsWith(APPS_SCRIPT_URL))
        .map(([url]) => resourceFromUrl(url))
    ).toEqual(["media-upload-start", "media-upload-chunk", "media-upload-status"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("retries a transient upload-start upstream failure with bounded backoff", async () => {
    const imageUrl = "https://scontent.fbcdn.net/v/t39.30808-6/start-retry.jpg";
    const delay = vi.fn(async () => undefined);
    let startCalls = 0;
    let deterministicId = "";

    const fetchImpl = vi.fn(async (url, init = {}) => {
      const value = String(url);
      if (value === `${WORKER_ORIGIN}/api/admin/media-bridge-authorization`) {
        return authorizationSuccess();
      }
      if (value.startsWith("https://www.facebook.com/example/posts/123")) {
        return new Response(`<meta property="og:image" content="${imageUrl}">`);
      }
      if (value === imageUrl) {
        return new Response(Uint8Array.from([1, 2, 3, 4]), { headers: { "Content-Type": "image/jpeg" } });
      }
      if (value.startsWith(APPS_SCRIPT_URL)) {
        const resource = resourceFromUrl(value);
        const payload = JSON.parse(init.body);
        deterministicId ||= payload.id;
        if (resource === "media-upload-start") {
          startCalls += 1;
          if (startCalls === 1) {
            return new Response("temporarily unavailable", { status: 503 });
          }
          return Response.json({
            uploadComplete: false,
            uploadUrl: UPLOAD_URL,
            totalBytes: 4,
            chunkSizeBytes: CHUNK_SIZE,
            nextByte: 0,
            statusCode: 200
          });
        }
        if (resource === "media-upload-chunk") {
          return Response.json({ uploadComplete: true, asset: completedAsset(deterministicId), statusCode: 200 });
        }
      }
      throw new Error(`Unexpected URL: ${value}`);
    });

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await callFacebookThumbnail(fetchImpl, undefined, delay);

    expect(response.statusCode).toBe(200);
    expect(startCalls).toBe(2);
    expect(delay).toHaveBeenCalledWith(250);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("accepts web.facebook.com sources through the thumbnail bridge", async () => {
    const imageUrl = "https://scontent.fbcdn.net/v/t39.30808-6/web-source.jpg";
    let deterministicId = "";

    const fetchImpl = vi.fn(async (url, init = {}) => {
      const value = String(url);
      if (value === `${WORKER_ORIGIN}/api/admin/media-bridge-authorization`) {
        return authorizationSuccess();
      }
      if (value.startsWith("https://web.facebook.com/example/posts/123")) {
        return new Response(`<html><head><meta property="og:image" content="${imageUrl}"></head></html>`);
      }
      if (value === imageUrl) {
        return new Response(Uint8Array.from([1, 2, 3, 4]), { headers: { "Content-Type": "image/jpeg" } });
      }
      if (value.startsWith(APPS_SCRIPT_URL)) {
        const resource = resourceFromUrl(value);
        const payload = JSON.parse(init.body);
        deterministicId ||= payload.id;
        if (resource === "media-upload-start") {
          return Response.json({
            uploadComplete: false,
            uploadUrl: UPLOAD_URL,
            totalBytes: 4,
            chunkSizeBytes: CHUNK_SIZE,
            nextByte: 0,
            statusCode: 200
          });
        }
        if (resource === "media-upload-chunk") {
          return Response.json({
            uploadComplete: true,
            asset: completedAsset(deterministicId, "web-file-id"),
            statusCode: 200
          });
        }
      }
      throw new Error(`Unexpected URL: ${value}`);
    });

    const response = await callFacebookThumbnail(fetchImpl, "https://web.facebook.com/example/posts/123");

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson.thumbnailUrl).toContain("drive.google.com/thumbnail");
  });

  it("rejects non-Facebook source URLs before attempting a remote preview fetch", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url) === `${WORKER_ORIGIN}/api/admin/media-bridge-authorization`) {
        return authorizationSuccess();
      }
      throw new Error("remote fetch should not occur");
    });

    const response = await callFacebookThumbnail(fetchImpl, "https://example.com/post/123");

    expect(response.statusCode).toBe(400);
    expect(response.bodyJson).toEqual({ error: "invalid Facebook content URL" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
