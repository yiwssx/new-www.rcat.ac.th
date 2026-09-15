const META_GRAPH_VERSION = "v25.0";
const FACEBOOK_OEMBED_POST_ENDPOINT = `https://graph.facebook.com/${META_GRAPH_VERSION}/oembed_post`;
const FACEBOOK_OEMBED_VIDEO_ENDPOINT = `https://graph.facebook.com/${META_GRAPH_VERSION}/oembed_video`;
const ALLOWED_FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"]);
const SUCCESS_CACHE_CONTROL = "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";
const FAILURE_CACHE_CONTROL = "public, max-age=60, s-maxage=300";

function sendJson(response, statusCode, payload, cacheControl = FAILURE_CACHE_CONTROL) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
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

export function createFacebookOembedCandidates(value) {
  const normalized = normalizeFacebookUrl(value);
  if (!normalized) return [];

  const url = new URL(normalized);
  const directReel = directReelCandidate(url);
  if (directReel) return [directReel];

  const post = postCandidate(url) || permalinkCandidate(url);
  if (!post) return [];

  const derivedReel = reelCandidateFromPostId(post.postId);
  // Historical RCAT imports sometimes stored a Reel as /{page}/posts/{reel-id}.
  // Probe the canonical Reel URL first; a normal post ID will simply fail the
  // video oEmbed probe and fall back to the original post URL.
  return derivedReel ? [derivedReel, post] : [post];
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

export async function handleFacebookOembedRequest(request, response, options = {}) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  const requestUrl = new URL(request.url || "/api/facebook-oembed", "https://www.rcat.ac.th");
  const sourceUrl = requestUrl.searchParams.get("url") || "";
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
