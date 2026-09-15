import { describe, expect, it, vi } from "vitest";
import { createFacebookOembedCandidates, handleFacebookOembedRequest, resolveFacebookOembed } from "./handler.mjs";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}

function createNodeResponse() {
  const headers = new Map();
  let body = "";

  return {
    statusCode: 0,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    end(value = "") {
      body = String(value);
    },
    read() {
      return {
        statusCode: this.statusCode,
        headers,
        body: body ? JSON.parse(body) : null
      };
    }
  };
}

const pageId = "1609435494524655";
const legacyReelId = "1639846248150246";
const normalPostId = "1674126058055598";
const legacyReelPostUrl = `https://www.facebook.com/${pageId}/posts/${legacyReelId}`;
const legacyReelUrl = `https://www.facebook.com/reel/${legacyReelId}/`;
const normalPostUrl = `https://www.facebook.com/${pageId}/posts/${normalPostId}`;

describe("Facebook tokenless oEmbed resolver", () => {
  it("keeps confirmed legacy Reel imports Reel-first without changing normal post semantics", () => {
    expect(createFacebookOembedCandidates(legacyReelPostUrl)).toEqual([
      {
        kind: "reel",
        canonicalUrl: legacyReelUrl,
        endpoint: "https://graph.facebook.com/v25.0/oembed_video"
      },
      {
        kind: "post",
        canonicalUrl: legacyReelPostUrl,
        endpoint: "https://graph.facebook.com/v25.0/oembed_post",
        postId: legacyReelId
      }
    ]);

    expect(createFacebookOembedCandidates(normalPostUrl)).toEqual([
      {
        kind: "post",
        canonicalUrl: normalPostUrl,
        endpoint: "https://graph.facebook.com/v25.0/oembed_post",
        postId: normalPostId
      },
      {
        kind: "reel",
        canonicalUrl: `https://www.facebook.com/reel/${normalPostId}/`,
        endpoint: "https://graph.facebook.com/v25.0/oembed_video"
      }
    ]);
  });

  it("restores the confirmed historical Reel even when its stored URL uses /posts/", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const requested = new URL(String(url));
      expect(requested.pathname).toBe("/v25.0/oembed_video");
      expect(requested.searchParams.get("url")).toBe(legacyReelUrl);
      return jsonResponse({ html: '<div class="fb-video"></div>' });
    });

    await expect(resolveFacebookOembed(legacyReelPostUrl, fetchImpl)).resolves.toEqual({
      kind: "reel",
      canonicalUrl: legacyReelUrl
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps the real normal /posts/ URL as a post and never probes video after post success", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const requested = new URL(String(url));
      expect(requested.pathname).toBe("/v25.0/oembed_post");
      expect(requested.searchParams.get("url")).toBe(normalPostUrl);
      return jsonResponse({ html: '<div class="fb-post"></div>' });
    });

    await expect(resolveFacebookOembed(normalPostUrl, fetchImpl)).resolves.toEqual({
      kind: "post",
      canonicalUrl: normalPostUrl
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("can still fall back to a derived Reel when an unclassified post oEmbed is unavailable", async () => {
    const genericPostUrl = `https://www.facebook.com/${pageId}/posts/111`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Unsupported get request" } }, 400))
      .mockResolvedValueOnce(jsonResponse({ html: '<div class="fb-video"></div>' }));

    await expect(resolveFacebookOembed(genericPostUrl, fetchImpl)).resolves.toEqual({
      kind: "reel",
      canonicalUrl: "https://www.facebook.com/reel/111/"
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstRequest = new URL(String(fetchImpl.mock.calls[0][0]));
    const secondRequest = new URL(String(fetchImpl.mock.calls[1][0]));
    expect(firstRequest.pathname).toBe("/v25.0/oembed_post");
    expect(secondRequest.pathname).toBe("/v25.0/oembed_video");
  });

  it("serves the confirmed legacy Reel classification through the same-origin resolver", async () => {
    const response = createNodeResponse();
    const fetchImpl = vi.fn(async () => jsonResponse({ html: '<div class="fb-video">remote html</div>' }));

    await handleFacebookOembedRequest(
      {
        method: "GET",
        url: `/api/facebook-oembed?url=${encodeURIComponent(legacyReelPostUrl)}`
      },
      response,
      { fetchImpl }
    );

    const result = response.read();
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      kind: "reel",
      canonicalUrl: legacyReelUrl
    });
    expect(result.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(JSON.stringify(result.body)).not.toContain("remote html");
  });

  it("rejects non-Facebook URLs before making an upstream request", async () => {
    const response = createNodeResponse();
    const fetchImpl = vi.fn();

    await handleFacebookOembedRequest(
      {
        method: "GET",
        url: "/api/facebook-oembed?url=https%3A%2F%2Fexample.com%2Fvideo"
      },
      response,
      { fetchImpl }
    );

    expect(response.read().statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
