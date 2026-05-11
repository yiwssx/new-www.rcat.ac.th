const allowedFacebookHosts = new Set(["facebook.com", "www.facebook.com", "m.facebook.com"]);

function hasUnsafeUrlCharacter(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code <= 31 || code === 127 || char === "\\" || /\s/.test(char)) {
      return true;
    }
  }

  return false;
}

function isAllowedFacebookPostPath(pathname: string, searchParams: URLSearchParams) {
  const normalizedPath = pathname.toLowerCase();
  const segments = normalizedPath.split("/").filter(Boolean);

  if (normalizedPath === "/permalink.php" || normalizedPath === "/story.php") {
    return Boolean(searchParams.get("story_fbid"));
  }

  if (normalizedPath === "/photo.php") {
    return Boolean(searchParams.get("fbid"));
  }

  if (segments.length >= 2 && segments[1] === "posts") {
    return true;
  }

  if (segments.includes("photos")) {
    return true;
  }

  if (segments[0] === "share" && (segments[1] === "p" || segments[1] === "v") && segments.length >= 3) {
    return true;
  }

  if (segments[0] === "watch" && (segments.length >= 2 || Boolean(searchParams.get("v")))) {
    return true;
  }

  if (segments[0] === "reel" && segments.length >= 2) {
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

    return isAllowedFacebookPostPath(parsed.pathname, parsed.searchParams) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function isValidFacebookPostUrl(value: string): boolean {
  return Boolean(normalizeFacebookPostUrl(value));
}
