import { describe, expect, it, vi } from "vitest";
import {
  createFacebookOembedCandidates,
  handleFacebookOembedRequest,
  resolveFacebookOembed
} from "./handler.mjs";

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

describe("Facebook tokenless oEmbed resolver", () => {
  it("probes a canonical Reel candidate before a historical numeric /posts/ URL", () => {
    expect(createFacebookOembedCandidates("https://www.facebook.com/1609435494524655/posts/1639846248150246")).toEqual([
      {
        kind: "reel",
        canonicalUrl: "https://www.facebook.com/reel/1639846248150246/",
        endpoint: "https://graph.facebook.com/v25.0/oembed_video"
      },
      {
        kind: "post",
        canonicalUrl: "https://www.facebook.com/1609435494524655/posts/1639846248150246",
        endpoint: "https://graph.facebook.com/v25.0/oembed_post",
        postId: "1639846248150246"
      }
    ]);
  });

  it("resolves a historical /posts/{reel-id} URL to the canonical Reel when video oEmbed accepts it", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const requested = new URL(String(url));
      expect(requested.pathname).toBe("/v25.0/oembed_video");
      expect(requested.searchParams.get("url")).toBe("https://www.facebook.com/reel/1639846248150246/");
      return jsonResponse({ html: '<div class="fb-video"></div>' });
    });

    await expect(
      resolveFacebookOembed("https://www.facebook.com/1609435494524655/posts/1639846248150246", fetchImpl)
    ).resolves.toEqual({
      kind: "reel",
      canonicalUrl: "https://www.facebook.com/reel/1639846248150246/"
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the original post oEmbed when the derived Reel candidate is not valid", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Unsupported get request" } }, 400))
      .mockResolvedValueOnce(jsonResponse({ html: '<div class="fb-post"></div>' }));

    await expect(resolveFacebookOembed("https://www.facebook.com/1609435494524655/posts/111", fetchImpl)).resolves.toEqual({
      kind: "post",
      canonicalUrl: "https://www.facebook.com/1609435494524655/posts/111"
    });

    const secondRequest = new URL(String(fetchImpl.mock.calls[1][0]));
    expect(secondRequest.pathname).toBe("/v25.0/oembed_post");
    expect(secondRequest.searchParams.get("url")).toBe("https://www.facebook.com/1609435494524655/posts/111");
  });

  it("serves a cacheable same-origin JSON resolution without exposing Meta HTML", async () => {
    const response = createNodeResponse();
    const fetchImpl = vi.fn(async () => jsonResponse({ html: '<div class="fb-video">remote html</div>' }));

    await handleFacebookOembedRequest(
      {
        method: "GET",
        url: "/api/facebook-oembed?url=https%3A%2F%2Fwww.facebook.com%2F1609435494524655%2Fposts%2F1639846248150246"
      },
      response,
      { fetchImpl }
    );

    const result = response.read();
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      kind: "reel",
      canonicalUrl: "https://www.facebook.com/reel/1639846248150246/"
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
