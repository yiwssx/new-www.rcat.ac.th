import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { isPublicSiteViewPath, trackPublicPresence, trackPublicSiteView } from "./siteViewTracking";

const PRESENCE_HEARTBEAT_MS = 60_000;

export function PublicSiteViewTracker() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    trackPublicSiteView(pathname);

    if (!isPublicSiteViewPath(pathname)) {
      return undefined;
    }

    const sendPresence = () => {
      if (document.visibilityState === "visible") {
        trackPublicPresence(pathname);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendPresence();
      }
    };

    sendPresence();
    const heartbeatId = window.setInterval(sendPresence, PRESENCE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", sendPresence);

    return () => {
      window.clearInterval(heartbeatId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", sendPresence);
    };
  }, [pathname]);

  return null;
}
