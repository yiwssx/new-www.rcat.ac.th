import {
  CMS_AUTH_CHANNEL_NAME,
  CMS_SESSION_EXPIRED_EVENT,
  CMS_SESSION_EXPIRED_MESSAGE,
  CMS_SESSION_NOTICE_KEY
} from "./constants";

export type CmsSessionEvent = "session-changed" | "logged-out";

export function broadcastCmsSessionEvent(event: CmsSessionEvent) {
  if (typeof BroadcastChannel === "undefined") {
    return;
  }

  const channel = new BroadcastChannel(CMS_AUTH_CHANNEL_NAME);
  channel.postMessage(event);
  channel.close();
}

export function subscribeToCmsSessionEvents(listener: (event: CmsSessionEvent) => void) {
  if (typeof BroadcastChannel === "undefined") {
    return () => undefined;
  }

  const channel = new BroadcastChannel(CMS_AUTH_CHANNEL_NAME);
  const handleMessage = (message: MessageEvent<unknown>) => {
    if (message.data === "session-changed" || message.data === "logged-out") {
      listener(message.data);
    }
  };
  channel.addEventListener("message", handleMessage);

  return () => {
    channel.removeEventListener("message", handleMessage);
    channel.close();
  };
}

export function notifyCmsSessionExpired(message = CMS_SESSION_EXPIRED_MESSAGE) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(CMS_SESSION_NOTICE_KEY, message);
  } catch {
    // Session loss still propagates when non-sensitive notice storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent(CMS_SESSION_EXPIRED_EVENT));
}

export function consumeCmsSessionNotice() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const notice = window.sessionStorage.getItem(CMS_SESSION_NOTICE_KEY) ?? "";
    window.sessionStorage.removeItem(CMS_SESSION_NOTICE_KEY);
    return notice;
  } catch {
    return "";
  }
}
