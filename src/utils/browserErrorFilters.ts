const asyncResponseChannelError =
  "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received";

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

export function installBrowserErrorFilters() {
  if (typeof window === "undefined") {
    return;
  }

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
