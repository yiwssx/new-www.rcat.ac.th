const asyncResponseChannelError =
  "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received";
const vitePreloadReloadStorageKey = "rcat:vite-preload-reload-at";
export const VITE_PRELOAD_RELOAD_COOLDOWN_MS = 15_000;

function getErrorMessage(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (value && typeof value === "object" && "message" in value) {
    return String((value as { message?: unknown }).message ?? "");
  }

  return "";
}

function isInjectedBrowserMessageError(value: unknown) {
  return getErrorMessage(value).includes(asyncResponseChannelError);
}

export function shouldRecoverFromVitePreloadError(lastReloadAt: number, now = Date.now()) {
  return !Number.isFinite(lastReloadAt) || lastReloadAt <= 0 || now - lastReloadAt >= VITE_PRELOAD_RELOAD_COOLDOWN_MS;
}

function readLastVitePreloadReloadAt() {
  try {
    return Number(window.sessionStorage.getItem(vitePreloadReloadStorageKey) || 0);
  } catch {
    return 0;
  }
}

function recordVitePreloadReload(now: number) {
  try {
    window.sessionStorage.setItem(vitePreloadReloadStorageKey, String(now));
  } catch {
    // A blocked storage API must not prevent runtime recovery.
  }
}

function recoverFromVitePreloadError(event: Event) {
  const now = Date.now();
  if (!shouldRecoverFromVitePreloadError(readLastVitePreloadReloadAt(), now)) {
    return;
  }

  event.preventDefault();
  recordVitePreloadReload(now);
  window.location.reload();
}

export function installBrowserErrorFilters() {
  if (typeof window === "undefined") {
    return;
  }

  // Vite emits this event when a lazy chunk from an older deployment no longer exists.
  // Reloading once lets the browser fetch the current client entry and its new chunk graph.
  window.addEventListener("vite:preloadError", recoverFromVitePreloadError);

  window.addEventListener(
    "error",
    (event) => {
      if (isInjectedBrowserMessageError(event.error) || isInjectedBrowserMessageError(event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (isInjectedBrowserMessageError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
}
