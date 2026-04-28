const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function normalizeSafeHref(value: string): string {
  const href = String(value || "").trim();

  if (!href) {
    return "#";
  }

  if (/[\u0000-\u001F\u007F\s\\]/.test(href)) {
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
