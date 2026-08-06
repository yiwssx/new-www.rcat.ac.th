declare const __RCAT_SSR_CLIENT_ENTRY_PATH__: string | undefined;
declare const __RCAT_SSR_CLIENT_STYLESHEET_PATHS__: string[] | undefined;

export const SSR_DOCUMENT_MARKER_ATTRIBUTE = "data-rcat-ssr";
export const SSR_DOCUMENT_MARKER_VALUE = "true";
export const SSR_CLIENT_ENTRY_MARKER_ATTRIBUTE = "data-rcat-client-entry";
export const SSR_CLIENT_STYLESHEET_MARKER_ATTRIBUTE = "data-rcat-client-stylesheet";

const FALLBACK_CLIENT_ENTRY_PATH = "/assets/rcat-client.js";
const FALLBACK_CLIENT_STYLESHEET_PATHS = ["/assets/rcat-client.css"];

function getBuildClientEntryPath() {
  if (typeof __RCAT_SSR_CLIENT_ENTRY_PATH__ === "string" && __RCAT_SSR_CLIENT_ENTRY_PATH__) {
    return __RCAT_SSR_CLIENT_ENTRY_PATH__;
  }

  return FALLBACK_CLIENT_ENTRY_PATH;
}

function getBuildClientStylesheetPaths() {
  if (
    typeof __RCAT_SSR_CLIENT_STYLESHEET_PATHS__ !== "undefined" &&
    Array.isArray(__RCAT_SSR_CLIENT_STYLESHEET_PATHS__) &&
    __RCAT_SSR_CLIENT_STYLESHEET_PATHS__.length > 0
  ) {
    return __RCAT_SSR_CLIENT_STYLESHEET_PATHS__;
  }

  return FALLBACK_CLIENT_STYLESHEET_PATHS;
}

export function resolveSsrClientAssets() {
  if (typeof document !== "undefined") {
    const entryPath = document
      .querySelector<HTMLScriptElement>(`script[${SSR_CLIENT_ENTRY_MARKER_ATTRIBUTE}]`)
      ?.getAttribute("src");
    const stylesheetPaths = Array.from(
      document.querySelectorAll<HTMLLinkElement>(`link[${SSR_CLIENT_STYLESHEET_MARKER_ATTRIBUTE}]`)
    )
      .map((element) => element.getAttribute("href") || "")
      .filter(Boolean);

    if (entryPath && stylesheetPaths.length > 0) {
      return { entryPath, stylesheetPaths };
    }
  }

  return {
    entryPath: getBuildClientEntryPath(),
    stylesheetPaths: getBuildClientStylesheetPaths()
  };
}
