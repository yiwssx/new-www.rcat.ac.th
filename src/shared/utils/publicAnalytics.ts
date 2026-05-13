const GOOGLE_TAG_MANAGER_ID = "GTM-WTCRN6KX";
const GOOGLE_ANALYTICS_ID = "G-6L3DV71C2J";
const GOOGLE_TAG_MANAGER_SCRIPT_ID = "rcat-google-tag-manager";
const GOOGLE_ANALYTICS_SCRIPT_ID = "rcat-google-analytics";

type GtagArguments = [command: string, ...parameters: unknown[]];

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: GtagArguments) => void;
};

let googleTagManagerInitialized = false;
let googleAnalyticsInitialized = false;
let lastTrackedPagePath = "";

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

  ensureGoogleTagManager();
  ensureGoogleAnalytics();
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
    return;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  ensurePublicAnalytics();

  const analyticsWindow = getAnalyticsWindow();
  const pageViewFields = getCurrentPageViewFields();

  if (lastTrackedPagePath === pageViewFields.page_path) {
    return;
  }

  analyticsWindow.gtag?.("event", "page_view", pageViewFields);
  lastTrackedPagePath = pageViewFields.page_path;
}

export function resetPublicAnalyticsForTests() {
  googleTagManagerInitialized = false;
  googleAnalyticsInitialized = false;
  lastTrackedPagePath = "";
}
