import { recordSiteView, SiteViewInput } from "../../services/googleApi";

export const SITE_VISITOR_ID_STORAGE_KEY = "rcat.site.visitor.id";

const SITE_VIEW_THROTTLE_STORAGE_KEY = "rcat.site.view.throttle.v1";
const SITE_VIEW_THROTTLE_MS = 30 * 60 * 1000;
const SITE_VIEW_MAX_PATH_LENGTH = 240;
const SITE_VIEW_MAX_PAGE_TITLE_LENGTH = 120;
const SITE_VISITOR_ID_PATTERN = /^rcat_[A-Za-z0-9_-]{12,64}$/;

type SiteViewRecorder = (input: SiteViewInput) => boolean;

interface TrackSiteViewOptions {
  now?: () => number;
  record?: SiteViewRecorder;
}

let fallbackVisitorId = "";
let fallbackThrottle: Record<string, number> = {};

function normalizePathname(pathname: string) {
  const [pathWithoutQuery] = String(pathname || "/").split(/[?#]/u);
  const normalized = pathWithoutQuery || "/";

  return normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

export function isPublicSiteViewPath(pathname: string) {
  const normalized = normalizePathname(pathname);

  return normalized !== "/login" && normalized !== "/admin" && !normalized.startsWith("/admin/");
}

function getStorageValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Tracking must never affect the public UI.
  }
}

function createAnonymousVisitorId() {
  const cryptoWithUuid = typeof crypto !== "undefined" ? crypto : undefined;
  const randomValue =
    typeof cryptoWithUuid?.randomUUID === "function"
      ? cryptoWithUuid.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

  return `rcat_${randomValue.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64)}`;
}

function getOrCreateAnonymousVisitorId() {
  if (typeof window === "undefined") {
    return fallbackVisitorId || createAnonymousVisitorId();
  }

  const storedVisitorId = getStorageValue(SITE_VISITOR_ID_STORAGE_KEY);

  if (storedVisitorId && SITE_VISITOR_ID_PATTERN.test(storedVisitorId)) {
    return storedVisitorId;
  }

  const visitorId = createAnonymousVisitorId();
  setStorageValue(SITE_VISITOR_ID_STORAGE_KEY, visitorId);
  fallbackVisitorId = visitorId;
  return visitorId;
}

function readThrottleState() {
  if (typeof window === "undefined") {
    return { ...fallbackThrottle };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SITE_VIEW_THROTTLE_STORAGE_KEY) || "{}");

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed).reduce<Record<string, number>>((state, [path, value]) => {
        const timestamp = Number(value);

        if (Number.isFinite(timestamp)) {
          state[path] = timestamp;
        }

        return state;
      }, {});
    }
  } catch {
    // Ignore corrupt throttle state and replace it on the next write.
  }

  return {};
}

function writeThrottleState(state: Record<string, number>) {
  fallbackThrottle = { ...state };

  if (typeof window === "undefined") {
    return;
  }

  setStorageValue(SITE_VIEW_THROTTLE_STORAGE_KEY, JSON.stringify(state));
}

function shouldThrottlePath(path: string, now: number) {
  const throttleState = readThrottleState();
  const lastTrackedAt = throttleState[path] || 0;

  if (lastTrackedAt && now - lastTrackedAt < SITE_VIEW_THROTTLE_MS) {
    return true;
  }

  const nextState = Object.entries(throttleState).reduce<Record<string, number>>((state, [trackedPath, timestamp]) => {
    if (now - timestamp < SITE_VIEW_THROTTLE_MS * 2) {
      state[trackedPath] = timestamp;
    }

    return state;
  }, {});

  nextState[path] = now;
  writeThrottleState(nextState);
  return false;
}

function getSafeReferrerOrigin() {
  if (typeof document === "undefined" || !document.referrer) {
    return "";
  }

  try {
    const referrerUrl = new URL(document.referrer);

    if (referrerUrl.protocol !== "http:" && referrerUrl.protocol !== "https:") {
      return "";
    }

    return referrerUrl.origin.slice(0, 120);
  } catch {
    return "";
  }
}

function getSafePageTitle() {
  if (typeof document === "undefined") {
    return "";
  }

  return document.title.trim().replace(/\s+/g, " ").slice(0, SITE_VIEW_MAX_PAGE_TITLE_LENGTH);
}

export function trackPublicSiteView(pathname: string, options: TrackSiteViewOptions = {}) {
  const path = normalizePathname(pathname).slice(0, SITE_VIEW_MAX_PATH_LENGTH);

  if (!isPublicSiteViewPath(path)) {
    return false;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const now = options.now ? options.now() : Date.now();

  if (shouldThrottlePath(path, now)) {
    return false;
  }

  try {
    const recorder = options.record || recordSiteView;
    const payload: SiteViewInput = {
      visitorId: getOrCreateAnonymousVisitorId(),
      path,
      timestamp: new Date(now).toISOString()
    };
    const referrerOrigin = getSafeReferrerOrigin();
    const pageTitle = getSafePageTitle();

    if (referrerOrigin) {
      payload.referrerOrigin = referrerOrigin;
    }

    if (pageTitle) {
      payload.pageTitle = pageTitle;
    }

    return recorder(payload);
  } catch {
    return false;
  }
}

export function resetSiteViewTrackingForTests() {
  fallbackVisitorId = "";
  fallbackThrottle = {};
}
