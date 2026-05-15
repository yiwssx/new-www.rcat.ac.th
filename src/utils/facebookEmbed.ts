const allowedFacebookHosts = new Set(["facebook.com", "www.facebook.com", "m.facebook.com"]);
const facebookPostPluginBaseUrl = "https://www.facebook.com/plugins/post.php";
const defaultFacebookPostWidth = 500;
const minimumFacebookPostWidth = 350;
const maximumFacebookPostWidth = 750;

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
 * Checks if a Facebook URL is supported for iframe embedding.
 * Only permalink.php, story.php, and /posts paths are supported.
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

  // /watch/... paths (videos)
  if (segments[0] === "watch" && (segments.length >= 2 || Boolean(searchParams.get("v")))) {
    return true;
  }

  // /reel/... paths
  if (segments[0] === "reel" && segments.length >= 2) {
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

    return isSupportedFacebookPostPath(parsed.pathname, parsed.searchParams) ? parsed.toString() : "";
  } catch {
    return "";
  }
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

    // It's a valid Facebook URL but not supported for iframe
    return isValidButUnsupportedFacebookPath(parsed.pathname, parsed.searchParams);
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

  const pluginUrl = new URL(facebookPostPluginBaseUrl);
  pluginUrl.searchParams.set("href", href);
  pluginUrl.searchParams.set("show_text", input.showText ? "true" : "false");
  pluginUrl.searchParams.set("width", String(clampFacebookPostPluginWidth(input.width)));

  return pluginUrl.toString();
}
