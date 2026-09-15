import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { normalizeSafeHref } from "../../utils/safeUrl";

const FACEBOOK_SDK_SCRIPT_ID = "facebook-jssdk";
const FACEBOOK_SDK_SRC = "https://connect.facebook.net/th_TH/sdk.js#xfbml=1&version=v25.0&autoLogAppEvents=0";
const DEFAULT_EMBED_WIDTH = 320;
const MINIMUM_EMBED_WIDTH = 220;
const MAXIMUM_EMBED_WIDTH = 440;

interface FacebookSdkWindow extends Window {
  FB?: {
    XFBML?: {
      parse?: (element?: HTMLElement) => void;
    };
  };
}

let facebookSdkPromise: Promise<void> | null = null;

function clampEmbedWidth(value: number) {
  return Math.min(MAXIMUM_EMBED_WIDTH, Math.max(MINIMUM_EMBED_WIDTH, Math.round(value)));
}

function ensureFacebookSdk() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }

  const sdkWindow = window as FacebookSdkWindow;
  if (sdkWindow.FB?.XFBML?.parse) {
    return Promise.resolve();
  }

  if (facebookSdkPromise && document.getElementById(FACEBOOK_SDK_SCRIPT_ID)) {
    return facebookSdkPromise;
  }

  if (facebookSdkPromise) {
    facebookSdkPromise = null;
  }

  facebookSdkPromise = new Promise<void>((resolve, reject) => {
    const finish = () => {
      const currentWindow = window as FacebookSdkWindow;
      if (currentWindow.FB?.XFBML?.parse) {
        resolve();
        return;
      }

      reject(new Error("Facebook SDK loaded without XFBML support"));
    };

    const existingScript = document.getElementById(FACEBOOK_SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Facebook SDK failed to load")), { once: true });
      window.setTimeout(finish, 0);
      return;
    }

    if (!document.getElementById("fb-root")) {
      const root = document.createElement("div");
      root.id = "fb-root";
      document.body.prepend(root);
    }

    const script = document.createElement("script");
    script.id = FACEBOOK_SDK_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = FACEBOOK_SDK_SRC;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Facebook SDK failed to load")), { once: true });
    document.body.appendChild(script);
  }).catch((error) => {
    facebookSdkPromise = null;
    throw error;
  });

  return facebookSdkPromise;
}

export type FacebookSdkEmbedMode = "post" | "video";

interface FacebookReelSdkEmbedProps {
  href: string;
  preferredWidth?: number;
  mode?: FacebookSdkEmbedMode;
  showText?: boolean;
}

export default function FacebookReelSdkEmbed({
  href,
  preferredWidth = MAXIMUM_EMBED_WIDTH,
  mode = "video",
  showText = true
}: FacebookReelSdkEmbedProps) {
  const safeHref = normalizeSafeHref(href);
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderWidth, setRenderWidth] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const availableWidth = host.getBoundingClientRect().width || DEFAULT_EMBED_WIDTH;
    setRenderWidth(clampEmbedWidth(Math.min(availableWidth, preferredWidth)));
  }, [preferredWidth]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !renderWidth || safeHref === "#") {
      return;
    }

    let cancelled = false;

    void ensureFacebookSdk()
      .then(() => {
        if (cancelled || !hostRef.current) {
          return;
        }

        const sdkWindow = window as FacebookSdkWindow;
        sdkWindow.FB?.XFBML?.parse?.(hostRef.current);
      })
      .catch(() => {
        // The public source link remains available when Meta refuses to render
        // the SDK embed or the SDK cannot be reached.
      });

    return () => {
      cancelled = true;
    };
  }, [mode, renderWidth, safeHref, showText]);

  if (safeHref === "#") {
    return null;
  }

  const reservedHeight = mode === "video" ? Math.round((renderWidth || DEFAULT_EMBED_WIDTH) * (16 / 9)) : 180;

  return (
    <Box
      ref={hostRef}
      data-facebook-sdk-embed="true"
      data-facebook-sdk-embed-mode={mode}
      data-facebook-reel-sdk-embed={mode === "video" ? "true" : undefined}
      sx={{
        width: "100%",
        maxWidth: MAXIMUM_EMBED_WIDTH,
        minHeight: reservedHeight,
        mx: "auto",
        overflow: "hidden"
      }}
    >
      {renderWidth ? (
        mode === "video" ? (
          <div
            className="fb-video"
            data-href={safeHref}
            data-width={String(renderWidth)}
            data-show-text="false"
            data-allowfullscreen="true"
            data-autoplay="false"
          />
        ) : (
          <div
            className="fb-post"
            data-href={safeHref}
            data-width={String(renderWidth)}
            data-show-text={showText ? "true" : "false"}
          />
        )
      ) : null}
    </Box>
  );
}
