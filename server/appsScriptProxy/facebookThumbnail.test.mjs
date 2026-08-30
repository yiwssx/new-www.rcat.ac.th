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

async function callFacebookThumbnail(fetchImpl, sourceUrl = "https://www.facebook.com/example/posts/123") {
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
    { env: createEnv(), fetchImpl }
  );
  return response;
}

describe("Facebook thumbnail media ingestion", () => {
  it("copies a public Facebook preview image into the existing Apps Script media bridge", async () => {
    const imageUrl = "https://scontent.fbcdn.net/v/t39.30808-6/example.jpg?x=1&amp;y=2";
    const expectedImageUrl = imageUrl.replace("&amp;", "&");
    const returnedAsset = {
      id: "facebook-thumbnail-placeholder",
      name: "Facebook - ข่าวทดสอบ",
      type: "image",
      size: "4 B",
      owner: "Admin",
      driveUrl: "https://drive.google.com/file/d/file-id/view",
      fileId: "file-id",
      mimeType: "image/jpeg",
      thumbnailUrl: "https://drive.google.com/thumbnail?id=file-id&sz=w1200",
      previewUrl: "https://drive.google.com/thumbnail?id=file-id&sz=w1200",
      embedUrl: "https://drive.google.com/file/d/file-id/preview",
      updatedAt: "2026-08-30T00:00:00.000Z"
    };

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
        const payload = JSON.parse(init.body);
        returnedAsset.id = payload.id;
        return Response.json(returnedAsset);
      }
      throw new Error(`Unexpected URL: ${value}`);
    });

    const response = await callFacebookThumbnail(fetchImpl);

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson.type).toBe("image");
    expect(response.bodyJson.driveUrl).toContain("drive.google.com");

    const appsScriptCall = fetchImpl.mock.calls.find(([url]) => String(url).startsWith(APPS_SCRIPT_URL));
    expect(appsScriptCall).toBeTruthy();
    expect(String(appsScriptCall[0])).toContain("resource=media");
    const upstreamPayload = JSON.parse(appsScriptCall[1].body);
    expect(upstreamPayload.id).toMatch(/^facebook-thumbnail-[a-f0-9]{24}$/);
    expect(upstreamPayload.type).toBe("image");
    expect(upstreamPayload.mimeType).toBe("image/jpeg");
    expect(upstreamPayload.fileBase64).toBe("AQIDBA==");
    expect(upstreamPayload.appsScriptBridgeToken).toBe(BRIDGE_TOKEN);
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
