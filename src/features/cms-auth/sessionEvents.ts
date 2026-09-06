import {
  CMS_AUTH_CHANNEL_NAME,
  CMS_SESSION_EXPIRED_EVENT,
  CMS_SESSION_EXPIRED_MESSAGE,
  CMS_SESSION_NOTICE_KEY
} from "./constants";

export type CmsSessionEvent = "session-changed" | "logged-out";

let cmsSessionChannel: BroadcastChannel | null = null;

function getCmsSessionChannel() {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }

  cmsSessionChannel ??= new BroadcastChannel(CMS_AUTH_CHANNEL_NAME);
  return cmsSessionChannel;
}

export function broadcastCmsSessionEvent(event: CmsSessionEvent) {
  getCmsSessionChannel()?.postMessage(event);
}

export function subscribeToCmsSessionEvents(listener: (event: CmsSessionEvent) => void) {
  const channel = getCmsSessionChannel();

  if (!channel) {
    return () => undefined;
  }

  const handleMessage = (message: MessageEvent<unknown>) => {
    if (message.data === "session-changed" || message.data === "logged-out") {
      listener(message.data);
    }
  };
  channel.addEventListener("message", handleMessage);

  return () => {
    channel.removeEventListener("message", handleMessage);
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

  window.dispatchEvent(
    new CustomEvent(CMS_SESSION_EXPIRED_EVENT, {
      detail: { confirmSession: true }
    })
  );
}

export function clearCmsSessionNotice() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(CMS_SESSION_NOTICE_KEY);
  } catch {
    // A successful server revalidation is authoritative even when notice storage is unavailable.
  }
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
