import {
  isPublicTelemetryPath,
  normalizePublicTelemetryPath,
  sanitizePublicTelemetryPageTitle
} from "../telemetry/publicTelemetryRoutes";

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
let deprecatedBothWarningIssued = false;
let activePublicAnalyticsConsumers = 0;
let pendingPublicAnalyticsReleaseId: number | null = null;

export const isPublicAnalyticsPath = isPublicTelemetryPath;

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

  if (strategy === "gtag") {
    return strategy;
  }

  if (strategy === "both") {
    if (import.meta.env.DEV && !deprecatedBothWarningIssued) {
      console.warn('VITE_PUBLIC_ANALYTICS_STRATEGY="both" is deprecated; using the canonical GTM transport.');
      deprecatedBothWarningIssued = true;
    }

    return DEFAULT_PUBLIC_ANALYTICS_STRATEGY;
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

  if (strategy === "gtm") {
    ensureGoogleTagManager();
  }

  if (strategy === "gtag") {
    ensureGoogleAnalytics();
  }
}

function getCurrentPageViewFields(pathname: string) {
  const normalizedPath = normalizePublicTelemetryPath(pathname);
  return {
    page_path: normalizedPath,
    page_location: `${window.location.origin}${normalizedPath}`,
    page_title: sanitizePublicTelemetryPageTitle(normalizedPath, document.title)
  };
}

function cancelPendingPublicAnalyticsRelease() {
  if (pendingPublicAnalyticsReleaseId === null || typeof window === "undefined") {
    return;
  }

  window.clearTimeout(pendingPublicAnalyticsReleaseId);
  pendingPublicAnalyticsReleaseId = null;
}

export function retainPublicPageView() {
  activePublicAnalyticsConsumers += 1;
  cancelPendingPublicAnalyticsRelease();
  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    activePublicAnalyticsConsumers = Math.max(0, activePublicAnalyticsConsumers - 1);

    if (activePublicAnalyticsConsumers > 0) {
      return;
    }

    cancelPendingPublicPageView();

    if (typeof window === "undefined") {
      lastTrackedPagePath = "";
      return;
    }

    pendingPublicAnalyticsReleaseId = window.setTimeout(() => {
      pendingPublicAnalyticsReleaseId = null;

      if (activePublicAnalyticsConsumers === 0) {
        lastTrackedPagePath = "";
      }
    }, 0);
  };
}

export function trackPublicPageView(pathname: string) {
  const normalizedPath = normalizePublicTelemetryPath(pathname);

  if (!isPublicTelemetryPath(normalizedPath)) {
    cancelPendingPublicPageView();
    lastTrackedPagePath = "";
    return;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (lastTrackedPagePath === normalizedPath || pendingPageViewPath === normalizedPath) {
    return;
  }

  cancelPendingPublicPageView();
  pendingPageViewPath = normalizedPath;
  pendingPageViewHandle = scheduleIdlePageView(() => {
    const scheduledPagePath = pendingPageViewPath;
    pendingPageViewHandle = null;
    pendingPageViewPath = "";

    const currentPath = normalizePublicTelemetryPath(window.location.pathname);

    if (!isPublicTelemetryPath(currentPath)) {
      return;
    }

    if (currentPath !== scheduledPagePath || lastTrackedPagePath === currentPath) {
      return;
    }

    const currentPageViewFields = getCurrentPageViewFields(currentPath);
    ensurePublicAnalytics();
    sendPublicPageView(currentPageViewFields);
    lastTrackedPagePath = currentPath;
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

export function cancelPendingPublicPageView() {
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

export function releasePublicPageView() {
  cancelPendingPublicAnalyticsRelease();
  cancelPendingPublicPageView();
  activePublicAnalyticsConsumers = 0;
  lastTrackedPagePath = "";
}

function sendPublicPageView(pageViewFields: ReturnType<typeof getCurrentPageViewFields>) {
  const strategy = getPublicAnalyticsStrategy();
  const analyticsWindow = getAnalyticsWindow();

  if (strategy === "gtag") {
    analyticsWindow.gtag?.("event", "page_view", pageViewFields);
    return;
  }

  ensureDataLayer().push({
    event: "page_view",
    ...pageViewFields
  });
}

export function resetPublicAnalyticsForTests() {
  releasePublicPageView();
  googleTagManagerInitialized = false;
  googleAnalyticsInitialized = false;
  deprecatedBothWarningIssued = false;
}
