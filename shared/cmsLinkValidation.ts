export type CmsLinkKind = "canonical" | "navigation" | "resource";

const MAX_LINK_LENGTH = 4_096;
const NAVIGATION_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const CANONICAL_PROTOCOLS = new Set(["http:", "https:"]);
const RESOURCE_PROTOCOLS = new Set(["https:"]);
const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "web.facebook.com", "m.facebook.com"]);

function normalizedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasUnsafeCharacter(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 31 || codePoint === 127 || character === "\\" || /\s/u.test(character)) {
      return true;
    }
  }
  return false;
}

function absoluteProtocol(value: string) {
  const match = value.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/u);
  return match ? `${match[1].toLowerCase()}:` : "";
}

function isValidAbsoluteUrl(value: string, allowedProtocols: Set<string>) {
  const protocol = absoluteProtocol(value);
  if (!protocol || !allowedProtocols.has(protocol)) return false;
  if (protocol === "mailto:" || protocol === "tel:") return value.slice(protocol.length).length > 0;
  try {
    const url = new URL(value);
    return allowedProtocols.has(url.protocol.toLowerCase()) && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

// ASVS 1.2.2: decide placeholder-host policy from the parsed hostname, not a URL substring.
export function isExampleHostname(value: unknown) {
  const link = normalizedString(value);
  if (!link || link.length > MAX_LINK_LENGTH || hasUnsafeCharacter(link)) return false;

  try {
    const url = new URL(link);
    const hostname = url.hostname.toLowerCase();
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (hostname === "example.com" || hostname.endsWith(".example.com"))
    );
  } catch {
    return false;
  }
}

export function isValidFacebookEmbedPermalink(value: unknown) {
  const link = normalizedString(value);
  if (!link || link.length > MAX_LINK_LENGTH || hasUnsafeCharacter(link)) return false;
  try {
    const url = new URL(link);
    if (
      url.protocol !== "https:" ||
      !FACEBOOK_HOSTS.has(url.hostname.toLowerCase()) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return false;
    }
    const normalizedPath = url.pathname.toLowerCase();
    const segments = normalizedPath.split("/").filter(Boolean);
    if (normalizedPath === "/permalink.php" || normalizedPath === "/story.php") {
      return Boolean(url.searchParams.get("story_fbid") && url.searchParams.get("id"));
    }
    if (segments.length === 3 && segments[1] === "posts") return Boolean(segments[0] && segments[2]);
    return segments.length === 2 && segments[0] === "reel" && Boolean(segments[1]);
  } catch {
    return false;
  }
}

export function isValidCmsLink(value: unknown, kind: CmsLinkKind, allowEmpty = true) {
  const link = normalizedString(value);
  if (!link) return allowEmpty;
  if (link.length > MAX_LINK_LENGTH || hasUnsafeCharacter(link)) return false;
  if (kind === "navigation" && link.startsWith("#")) return true;
  if (link.startsWith("/")) return kind !== "canonical" && !link.startsWith("//");
  if (kind === "canonical") return isValidAbsoluteUrl(link, CANONICAL_PROTOCOLS);
  return isValidAbsoluteUrl(link, kind === "navigation" ? NAVIGATION_PROTOCOLS : RESOURCE_PROTOCOLS);
}
