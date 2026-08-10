const allowedFacebookHosts = new Set(["facebook.com", "www.facebook.com", "web.facebook.com", "m.facebook.com"]);
const facebookPostPluginBaseUrl = "https://www.facebook.com/plugins/post.php";
const facebookVideoPluginBaseUrl = "https://www.facebook.com/plugins/video.php";
const defaultFacebookPostWidth = 500;
const minimumFacebookPostWidth = 350;
const maximumFacebookPostWidth = 750;

export type FacebookEmbedKind = "post" | "reel";

function hasUnsafeUrlCharacter(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code <= 31 || code === 127 || char === "\\" || /\s/.test(char)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a Facebook URL is supported by the embedded post plugin.
 */
function isSupportedFacebookPostPath(pathname: string, searchParams: URLSearchParams) {
  const normalizedPath = pathname.toLowerCase();
  const segments = normalizedPath.split("/").filter(Boolean);

  // Support permalink.php?story_fbid=...&id=...
  if (normalizedPath === "/permalink.php") {
    return Boolean(searchParams.get("story_fbid") && searchParams.get("id"));
  }

  // Support story.php?story_fbid=...&id=...
  if (normalizedPath === "/story.php") {
    return Boolean(searchParams.get("story_fbid") && searchParams.get("id"));
  }

  // Support /{page}/posts/{postId}
  if (segments.length >= 2 && segments[1] === "posts") {
    return true;
  }

  return false;
}

/**
 * Checks if a Facebook URL is a direct Reel permalink that can be passed to
 * the embedded video player. Share redirect URLs are intentionally excluded.
 */
function isSupportedFacebookReelPath(pathname: string) {
  const segments = pathname.toLowerCase().split("/").filter(Boolean);

  return segments.length === 2 && segments[0] === "reel" && Boolean(segments[1]);
}

function getSupportedFacebookEmbedKind(pathname: string, searchParams: URLSearchParams): FacebookEmbedKind | "" {
  if (isSupportedFacebookReelPath(pathname)) {
    return "reel";
  }

  return isSupportedFacebookPostPath(pathname, searchParams) ? "post" : "";
}

/**
 * Checks if a URL is a valid Facebook URL but not supported for iframe embedding.
 * These URLs should show a fallback message instead of an iframe.
 */
function isValidButUnsupportedFacebookPath(pathname: string, searchParams: URLSearchParams) {
  const normalizedPath = pathname.toLowerCase();
  const segments = normalizedPath.split("/").filter(Boolean);

  // /share/p/... paths
  if (segments[0] === "share" && segments[1] === "p" && segments.length >= 3) {
    return true;
  }

  // /share/v/... paths
  if (segments[0] === "share" && segments[1] === "v" && segments.length >= 3) {
    return true;
  }

  // /share/r/... Reel redirect paths are not stable plugin permalinks.
  if (segments[0] === "share" && segments[1] === "r" && segments.length >= 3) {
    return true;
  }

  // /watch/... paths (videos)
  if (segments[0] === "watch" && (segments.length >= 2 || Boolean(searchParams.get("v")))) {
    return true;
  }

  // /photo.php paths (photos)
  if (normalizedPath === "/photo.php" && Boolean(searchParams.get("fbid"))) {
    return true;
  }

  // Group URLs
  if (segments.length >= 2 && (segments[1] === "groups" || normalizedPath.includes("groups"))) {
    return true;
  }

  return false;
}

/**
 * Backward-compatible normalizer for Facebook content embeds.
 * It accepts public post permalinks and direct /reel/{id} permalinks.
 */
export function normalizeFacebookPostUrl(value: string): string {
  const url = String(value || "").trim();

  if (!url || url === "#" || hasUnsafeUrlCharacter(url) || url.toLowerCase().includes("example.com")) {
    return "";
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:" || !allowedFacebookHosts.has(parsed.hostname.toLowerCase())) {
      return "";
    }

    return getSupportedFacebookEmbedKind(parsed.pathname, parsed.searchParams) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function getFacebookEmbedKind(value: string): FacebookEmbedKind | "" {
  const url = normalizeFacebookPostUrl(value);

  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    return getSupportedFacebookEmbedKind(parsed.pathname, parsed.searchParams);
  } catch {
    return "";
  }
}

export function isFacebookReelUrl(value: string): boolean {
  return getFacebookEmbedKind(value) === "reel";
}

/**
 * Checks if a URL is a valid but unsupported Facebook URL.
 * These URLs should render a fallback message instead of an iframe.
 */
export function isUnsupportedFacebookUrl(value: string): boolean {
  const url = String(value || "").trim();

  if (!url || url === "#" || hasUnsafeUrlCharacter(url) || url.toLowerCase().includes("example.com")) {
    return false;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:" || !allowedFacebookHosts.has(parsed.hostname.toLowerCase())) {
      return false;
    }

    return isValidButUnsupportedFacebookPath(parsed.pathname, parsed.searchParams);
  } catch {
    return false;
  }
}

export function isFacebookUrl(value: string): boolean {
  const url = String(value || "").trim();

  if (!url || url === "#" || hasUnsafeUrlCharacter(url) || url.toLowerCase().includes("example.com")) {
    return false;
  }

  try {
    const parsed = new URL(url);

    return parsed.protocol === "https:" && allowedFacebookHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isValidFacebookPostUrl(value: string): boolean {
  return Boolean(normalizeFacebookPostUrl(value));
}

export function clampFacebookPostPluginWidth(value: number): number {
  return Math.min(
    maximumFacebookPostWidth,
    Math.max(minimumFacebookPostWidth, Math.round(Number.isFinite(value) ? value : defaultFacebookPostWidth))
  );
}

export function buildFacebookPostPluginUrl(input: { href: string; showText: boolean; width: number }): string {
  const href = normalizeFacebookPostUrl(input.href);

  if (!href) {
    return "";
  }

  const embedKind = getFacebookEmbedKind(href);
  const pluginUrl = new URL(embedKind === "reel" ? facebookVideoPluginBaseUrl : facebookPostPluginBaseUrl);
  pluginUrl.searchParams.set("href", href);
  pluginUrl.searchParams.set("show_text", embedKind === "reel" ? "false" : input.showText ? "true" : "false");
  pluginUrl.searchParams.set("width", String(clampFacebookPostPluginWidth(input.width)));

  return pluginUrl.toString();
}
