const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

function hasUnsafeUrlCharacter(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code <= 31 || code === 127 || char === "\\" || /\s/.test(char)) {
      return true;
    }
  }

  return false;
}

export function normalizeSafeHref(value: string): string {
  const href = String(value || "").trim();

  if (!href) {
    return "#";
  }

  if (hasUnsafeUrlCharacter(href)) {
    return "#";
  }

  if (href.startsWith("#")) {
    return href;
  }

  if (href.startsWith("/")) {
    return href.startsWith("//") ? "#" : href;
  }

  const protocolMatch = href.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/);

  if (!protocolMatch) {
    return "#";
  }

  const protocol = `${protocolMatch[1].toLowerCase()}:`;

  return ALLOWED_PROTOCOLS.has(protocol) ? href : "#";
}

export function normalizeSafeResourceUrl(value: string | null | undefined): string {
  const href = normalizeSafeHref(value || "");

  if (href === "#") {
    return "";
  }

  const lowerHref = href.toLowerCase();

  if (href.startsWith("/") || lowerHref.startsWith("https://")) {
    return href;
  }

  return "";
}
