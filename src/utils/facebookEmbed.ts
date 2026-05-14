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
 * Validates if a Facebook URL path is supported for iframe embedding.
 * Only stable post URLs are supported:
 * - /page/posts/postId or /page/posts/pfbid...
 * - /permalink.php?story_fbid=...&id=...
 * - /story.php?story_fbid=...&id=...
 */
function isAllowedFacebookPostPath(pathname: string, searchParams: URLSearchParams) {
  const normalizedPath = pathname.toLowerCase();
  const segments = normalizedPath.split("/").filter(Boolean);

  // Permalink and story URLs require story_fbid parameter
  if (normalizedPath === "/permalink.php" || normalizedPath === "/story.php") {
    return Boolean(searchParams.get("story_fbid"));
  }

  // Standard /page/posts/postId format is supported
  if (segments.length >= 2 && segments[1] === "posts") {
    return true;
  }

  // All other paths are not supported for safe iframe embedding
  return false;
}

/**
 * Checks if a Facebook URL is valid but not supported for iframe embedding.
 * These URLs should show a fallback link instead of iframe.
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

    const normalizedPath = parsed.pathname.toLowerCase();
    const segments = normalizedPath.split("/").filter(Boolean);

    // Check for unsupported but valid Facebook URL patterns
    if (segments[0] === "share" && (segments[1] === "p" || segments[1] === "v")) {
      return true;
    }

    if (segments[0] === "watch") {
      return true;
    }

    if (segments[0] === "reel") {
      return true;
    }

    if (segments[0] === "video" && segments.length >= 2) {
      return true;
    }

    if (segments[0] === "photo" && segments.length >= 2) {
      return true;
    }

    if (segments[0] === "photos" && segments.length >= 2) {
      return true;
    }

    // Group URLs are not supported
    if (segments[0] === "groups") {
      return true;
    }

    // Check if it's a valid supported URL (would pass isAllowedFacebookPostPath)
    // If not, but it's still a Facebook URL, it's unsupported
    if (!isAllowedFacebookPostPath(parsed.pathname, parsed.searchParams)) {
      // It's a Facebook URL but not in a recognized format
      return true;
    }

    return false;
  } catch {
    return false;
  }
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

    return isAllowedFacebookPostPath(parsed.pathname, parsed.searchParams) ? parsed.toString() : "";
  } catch {
    return "";
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
