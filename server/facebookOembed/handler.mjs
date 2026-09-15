const META_GRAPH_VERSION = "v25.0";
const FACEBOOK_OEMBED_POST_ENDPOINT = `https://graph.facebook.com/${META_GRAPH_VERSION}/oembed_post`;
const FACEBOOK_OEMBED_VIDEO_ENDPOINT = `https://graph.facebook.com/${META_GRAPH_VERSION}/oembed_video`;
const ALLOWED_FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"]);
const SUCCESS_CACHE_CONTROL = "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";
const FAILURE_CACHE_CONTROL = "public, max-age=60, s-maxage=300";

// Older RCAT imports lost the original /reel/ permalink and persisted a
// /{page}/posts/{id} URL instead. Some of those URLs are also accepted by
// Meta's post oEmbed endpoint, so endpoint success alone cannot recover the
// original content type. Keep only confirmed legacy Reel identities here so
// normal /posts/ URLs remain post-first.
const CONFIRMED_LEGACY_REEL_POSTS = new Set(["1609435494524655:1639846248150246"]);

function responseHeaders(cacheControl = FAILURE_CACHE_CONTROL) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff"
  };
}

function sendJson(response, statusCode, payload, cacheControl = FAILURE_CACHE_CONTROL) {
  response.statusCode = statusCode;
  for (const [name, value] of Object.entries(responseHeaders(cacheControl))) {
    response.setHeader(name, value);
  }
  response.end(JSON.stringify(payload));
}

function createJsonResponse(statusCode, payload, cacheControl = FAILURE_CACHE_CONTROL, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      ...responseHeaders(cacheControl),
      ...extraHeaders
    }
  });
}

function normalizeFacebookUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !ALLOWED_FACEBOOK_HOSTS.has(url.hostname.toLowerCase())) return "";

    url.hostname = "www.facebook.com";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function directReelCandidate(url) {
  const match = url.pathname.match(/^\/reel\/([^/]+)\/?$/iu);
  if (!match) return null;

  return {
    kind: "reel",
    canonicalUrl: `https://www.facebook.com/reel/${encodeURIComponent(decodeURIComponent(match[1]))}/`,
    endpoint: FACEBOOK_OEMBED_VIDEO_ENDPOINT
  };
}

function postCandidate(url) {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 3 || segments[1].toLowerCase() !== "posts") return null;

  return {
    kind: "post",
    canonicalUrl: url.toString(),
    endpoint: FACEBOOK_OEMBED_POST_ENDPOINT,
    postId: segments[2]
  };
}

function permalinkCandidate(url) {
  const normalizedPath = url.pathname.toLowerCase();
  if (normalizedPath !== "/permalink.php" && normalizedPath !== "/story.php") return null;

  const postId = url.searchParams.get("story_fbid");
  const pageId = url.searchParams.get("id");
  if (!postId || !pageId) return null;

  return {
    kind: "post",
    canonicalUrl: url.toString(),
    endpoint: FACEBOOK_OEMBED_POST_ENDPOINT,
    postId
  };
}

function reelCandidateFromPostId(postId) {
  if (!/^\d+$/u.test(String(postId ?? ""))) return null;

  return {
    kind: "reel",
    canonicalUrl: `https://www.facebook.com/reel/${postId}/`,
    endpoint: FACEBOOK_OEMBED_VIDEO_ENDPOINT
  };
}

function facebookPageId(url) {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 3 && segments[1].toLowerCase() === "posts") {
    return segments[0];
  }

  const normalizedPath = url.pathname.toLowerCase();
  if (normalizedPath === "/permalink.php" || normalizedPath === "/story.php") {
    return url.searchParams.get("id") || "";
  }

  return "";
}

function isConfirmedLegacyReel(url, postId) {
  const pageId = facebookPageId(url);
  return Boolean(pageId && postId && CONFIRMED_LEGACY_REEL_POSTS.has(`${pageId}:${postId}`));
}

export function createFacebookOembedCandidates(value) {
  const normalized = normalizeFacebookUrl(value);
  if (!normalized) return [];

  const url = new URL(normalized);
  const directReel = directReelCandidate(url);
  if (directReel) return [directReel];

  const post = postCandidate(url) || permalinkCandidate(url);
  if (!post) return [];

  const derivedReel = reelCandidateFromPostId(post.postId);
  if (!derivedReel) return [post];

  // Preserve the confirmed historical Reel that was imported as /posts/ while
  // keeping every other explicit /posts/ URL post-first. This avoids the two
  // regressions caused by globally choosing either Reel-first or post-first.
  return isConfirmedLegacyReel(url, post.postId) ? [derivedReel, post] : [post, derivedReel];
}

async function probeCandidate(candidate, fetchImpl) {
  const endpoint = new URL(candidate.endpoint);
  endpoint.searchParams.set("url", candidate.canonicalUrl);
  endpoint.searchParams.set("maxwidth", "500");

  let response;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        Accept: "application/json"
      }
    });
  } catch {
    return false;
  }

  if (!response?.ok) return false;

  const payload = await response.json().catch(() => null);
  return Boolean(payload && typeof payload.html === "string" && payload.html.trim());
}

export async function resolveFacebookOembed(value, fetchImpl = globalThis.fetch) {
  const candidates = createFacebookOembedCandidates(value);
  if (!candidates.length || typeof fetchImpl !== "function") return null;

  for (const candidate of candidates) {
    if (await probeCandidate(candidate, fetchImpl)) {
      return {
        kind: candidate.kind,
        canonicalUrl: candidate.canonicalUrl
      };
    }
  }

  return null;
}

function sourceUrlFromRequestUrl(requestUrl) {
  return new URL(requestUrl || "/api/facebook-oembed", "https://www.rcat.ac.th").searchParams.get("url") || "";
}

export async function handleFacebookOembedFetchRequest(request, options = {}) {
  if (request.method !== "GET") {
    return createJsonResponse(405, { ok: false, error: "method_not_allowed" }, FAILURE_CACHE_CONTROL, {
      Allow: "GET"
    });
  }

  const sourceUrl = sourceUrlFromRequestUrl(request.url);
  const candidates = createFacebookOembedCandidates(sourceUrl);
  if (!candidates.length) {
    return createJsonResponse(400, { ok: false, error: "unsupported_facebook_url" });
  }

  const resolved = await resolveFacebookOembed(sourceUrl, options.fetchImpl ?? globalThis.fetch);
  if (!resolved) {
    return createJsonResponse(404, { ok: false, error: "facebook_embed_unavailable" });
  }

  return createJsonResponse(200, { ok: true, ...resolved }, SUCCESS_CACHE_CONTROL);
}

export async function handleFacebookOembedRequest(request, response, options = {}) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  const sourceUrl = sourceUrlFromRequestUrl(request.url);
  const candidates = createFacebookOembedCandidates(sourceUrl);

  if (!candidates.length) {
    sendJson(response, 400, { ok: false, error: "unsupported_facebook_url" });
    return;
  }

  const resolved = await resolveFacebookOembed(sourceUrl, options.fetchImpl ?? globalThis.fetch);
  if (!resolved) {
    sendJson(response, 404, { ok: false, error: "facebook_embed_unavailable" });
    return;
  }

  sendJson(response, 200, { ok: true, ...resolved }, SUCCESS_CACHE_CONTROL);
}
