const GOOGLE_TAG_MANAGER_ID = "GTM-WTCRN6KX";
const GOOGLE_ANALYTICS_ID = "G-6L3DV71C2J";
const GOOGLE_TAG_MANAGER_SCRIPT_ID = "rcat-google-tag-manager";
const GOOGLE_ANALYTICS_SCRIPT_ID = "rcat-google-analytics";
const DEFAULT_PUBLIC_ANALYTICS_STRATEGY = "gtm";

type GtagArguments = [command: string, ...parameters: unknown[]];
type PublicAnalyticsStrategy = "gtm" | "gtag" | "both";
type IdleCallbackHandle =
  | {
      type: "idle";
      id: number;
    }
  | {
      type: "timeout";
      id: number;
    };

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: GtagArguments) => void;
};

let googleTagManagerInitialized = false;
let googleAnalyticsInitialized = false;
let lastTrackedPagePath = "";
let pendingPageViewHandle: IdleCallbackHandle | null = null;
let pendingPageViewPath = "";

function normalizePathname(pathname: string) {
  const [pathWithoutQuery] = pathname.split(/[?#]/u);

  if (!pathWithoutQuery || pathWithoutQuery === "/") {
    return "/";
  }

  return pathWithoutQuery.endsWith("/") ? pathWithoutQuery.slice(0, -1) : pathWithoutQuery;
}

export function isPublicAnalyticsPath(pathname: string) {
  const pathnameWithoutTrailingSlash = normalizePathname(pathname);

  return (
    pathnameWithoutTrailingSlash !== "/login" &&
    pathnameWithoutTrailingSlash !== "/admin" &&
    !pathnameWithoutTrailingSlash.startsWith("/admin/")
  );
}

function getAnalyticsWindow() {
  return window as AnalyticsWindow;
}

function ensureDataLayer() {
  const analyticsWindow = getAnalyticsWindow();

  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];

  return analyticsWindow.dataLayer;
}

function appendAsyncScript(id: string, src: string) {
  if (document.getElementById(id)) {
    return;
  }

  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function getPublicAnalyticsStrategy(): PublicAnalyticsStrategy {
  const strategy = import.meta.env.VITE_PUBLIC_ANALYTICS_STRATEGY?.trim().toLowerCase();

  if (strategy === "gtag" || strategy === "both") {
    return strategy;
  }

  return DEFAULT_PUBLIC_ANALYTICS_STRATEGY;
}

function ensureGoogleTagManager() {
  if (googleTagManagerInitialized || document.getElementById(GOOGLE_TAG_MANAGER_SCRIPT_ID)) {
    googleTagManagerInitialized = true;
    return;
  }

  ensureDataLayer().push({
    "gtm.start": Date.now(),
    event: "gtm.js"
  });

  appendAsyncScript(
    GOOGLE_TAG_MANAGER_SCRIPT_ID,
    `https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_MANAGER_ID}`
  );
  googleTagManagerInitialized = true;
}

function ensureGoogleAnalytics() {
  const analyticsWindow = getAnalyticsWindow();

  ensureDataLayer();
  analyticsWindow.gtag =
    analyticsWindow.gtag ??
    ((...args: GtagArguments) => {
      analyticsWindow.dataLayer?.push(args);
    });

  appendAsyncScript(GOOGLE_ANALYTICS_SCRIPT_ID, `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`);

  if (googleAnalyticsInitialized) {
    return;
  }

  analyticsWindow.gtag("js", new Date());
  analyticsWindow.gtag("config", GOOGLE_ANALYTICS_ID, {
    send_page_view: false
  });
  googleAnalyticsInitialized = true;
}

function ensurePublicAnalytics() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const strategy = getPublicAnalyticsStrategy();

  if (strategy === "gtm" || strategy === "both") {
    ensureGoogleTagManager();
  }

  if (strategy === "gtag" || strategy === "both") {
    ensureGoogleAnalytics();
  }
}

function getCurrentPageViewFields() {
  const pageUrl = new URL(window.location.href);

  return {
    page_path: `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`,
    page_location: pageUrl.href,
    page_title: document.title
  };
}

export function trackPublicPageView(pathname: string) {
  if (!isPublicAnalyticsPath(pathname)) {
    cancelPendingPageView();
    return;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const pageViewFields = getCurrentPageViewFields();

  if (lastTrackedPagePath === pageViewFields.page_path || pendingPageViewPath === pageViewFields.page_path) {
    return;
  }

  cancelPendingPageView();
  pendingPageViewPath = pageViewFields.page_path;
  pendingPageViewHandle = scheduleIdlePageView(() => {
    const scheduledPagePath = pendingPageViewPath;
    pendingPageViewHandle = null;
    pendingPageViewPath = "";

    if (!isPublicAnalyticsPath(window.location.pathname)) {
      return;
    }

    const currentPageViewFields = getCurrentPageViewFields();

    if (
      currentPageViewFields.page_path !== scheduledPagePath ||
      lastTrackedPagePath === currentPageViewFields.page_path
    ) {
      return;
    }

    ensurePublicAnalytics();
    sendPublicPageView(currentPageViewFields);
    lastTrackedPagePath = currentPageViewFields.page_path;
  });
}

function scheduleIdlePageView(callback: () => void): IdleCallbackHandle {
  if (typeof window.requestIdleCallback === "function") {
    return {
      type: "idle",
      id: window.requestIdleCallback(callback, { timeout: 2000 })
    };
  }

  return {
    type: "timeout",
    id: window.setTimeout(callback, 0)
  };
}

function cancelPendingPageView() {
  if (!pendingPageViewHandle) {
    pendingPageViewPath = "";
    return;
  }

  if (pendingPageViewHandle.type === "idle" && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(pendingPageViewHandle.id);
  } else if (pendingPageViewHandle.type === "timeout") {
    window.clearTimeout(pendingPageViewHandle.id);
  }

  pendingPageViewHandle = null;
  pendingPageViewPath = "";
}

function sendPublicPageView(pageViewFields: ReturnType<typeof getCurrentPageViewFields>) {
  const strategy = getPublicAnalyticsStrategy();
  const analyticsWindow = getAnalyticsWindow();

  if (strategy === "gtag" || strategy === "both") {
    analyticsWindow.gtag?.("event", "page_view", pageViewFields);
    return;
  }

  ensureDataLayer().push({
    event: "page_view",
    ...pageViewFields
  });
}

export function resetPublicAnalyticsForTests() {
  cancelPendingPageView();
  googleTagManagerInitialized = false;
  googleAnalyticsInitialized = false;
  lastTrackedPagePath = "";
}
