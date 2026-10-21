export const PUBLIC_COOKIE_CONSENT_STORAGE_KEY = "rcat.cookie.consent.v1";
export const PUBLIC_COOKIE_CONSENT_OPEN_EVENT = "rcat:cookie-preferences:open";
export const PUBLIC_COOKIE_CONSENT_CHANGE_EVENT = "rcat:cookie-preferences:changed";

const COOKIE_CONSENT_VERSION = 1;
const CONSENT_VALIDITY_MS = 180 * 24 * 60 * 60 * 1000;
const OPTIONAL_SITE_VIEW_STORAGE_KEYS = ["rcat.site.visitor.id", "rcat.site.view.throttle.v1"] as const;

export interface PublicCookieConsentChoice {
  version: number;
  analytics: boolean;
  decidedAt: string;
}

/** An expired, malformed or incompatible record never authorizes optional analytics. */
export function parsePublicCookieConsent(value: string | null, now = Date.now()): PublicCookieConsentChoice | null {
  if (!value) return null;
  try {
    const candidate: unknown = JSON.parse(value);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const record = candidate as Record<string, unknown>;
    const timestamp = typeof record.decidedAt === "string" ? Date.parse(record.decidedAt) : NaN;
    if (
      record.version !== COOKIE_CONSENT_VERSION ||
      typeof record.analytics !== "boolean" ||
      !Number.isFinite(timestamp) ||
      timestamp > now ||
      now - timestamp >= CONSENT_VALIDITY_MS
    ) {
      return null;
    }

    return { version: COOKIE_CONSENT_VERSION, analytics: record.analytics, decidedAt: record.decidedAt as string };
  } catch {
    return null;
  }
}

/** Stable external-store primitives avoid setting React state synchronously in an effect. */
export function getPublicCookieConsentSnapshot(): string | null | undefined {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PUBLIC_COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getServerPublicCookieConsentSnapshot(): undefined {
  return undefined;
}

export function subscribePublicCookieConsent(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PUBLIC_COOKIE_CONSENT_STORAGE_KEY && event.key !== null) return;
    const previous = parsePublicCookieConsent(event.oldValue);
    const next = readPublicCookieConsent();

    if (previous?.analytics && !next?.analytics) {
      window.location.reload();
      return;
    }
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PUBLIC_COOKIE_CONSENT_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PUBLIC_COOKIE_CONSENT_CHANGE_EVENT, onChange);
  };
}

export function readPublicCookieConsent(): PublicCookieConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    return parsePublicCookieConsent(window.localStorage.getItem(PUBLIC_COOKIE_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Only a deliberate user action calls this. Necessary authentication cookies remain untouched. */
export function savePublicCookieConsent(analytics: boolean): PublicCookieConsentChoice {
  const choice: PublicCookieConsentChoice = {
    version: COOKIE_CONSENT_VERSION,
    analytics,
    decidedAt: new Date().toISOString()
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PUBLIC_COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // Storage might be unavailable; consent remains valid only for this browser session.
    }
    if (!analytics) clearOptionalAnalyticsStorage();
    window.dispatchEvent(new Event(PUBLIC_COOKIE_CONSENT_CHANGE_EVENT));
  }

  return choice;
}

function clearOptionalAnalyticsStorage() {
  for (const key of OPTIONAL_SITE_VIEW_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Disabling analytics must not break public navigation.
    }
  }

  // Best-effort cleanup for Google cookies accessible from this origin.
  // Third-party/domain-controlled cookies may require browser settings to remove.
  const domain = window.location.hostname;
  const candidateDomains = new Set(["", domain]);
  if (domain === "rcat.ac.th" || domain.endsWith(".rcat.ac.th")) {
    candidateDomains.add(".rcat.ac.th");
  }

  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (!name || !/^(?:_ga(?:_|$)|_gid$|_gat(?:_|$)|_gcl_)/.test(name)) continue;
    for (const cookieDomain of candidateDomains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${cookieDomain ? `; Domain=${cookieDomain}` : ""}`;
    }
  }
}

export function openPublicCookiePreferences() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PUBLIC_COOKIE_CONSENT_OPEN_EVENT));
  }
}
