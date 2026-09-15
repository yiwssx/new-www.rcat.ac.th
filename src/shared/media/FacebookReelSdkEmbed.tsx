import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { normalizeSafeHref } from "../../utils/safeUrl";

const FACEBOOK_SDK_SCRIPT_ID = "facebook-jssdk";
const FACEBOOK_SDK_SRC = "https://connect.facebook.net/th_TH/sdk.js#xfbml=1&version=v25.0&autoLogAppEvents=0";
const DEFAULT_REEL_WIDTH = 320;
const MINIMUM_REEL_WIDTH = 220;
const MAXIMUM_REEL_WIDTH = 440;

interface FacebookSdkWindow extends Window {
  FB?: {
    XFBML?: {
      parse?: (element?: HTMLElement) => void;
    };
  };
}

let facebookSdkPromise: Promise<void> | null = null;

function clampReelWidth(value: number) {
  return Math.min(MAXIMUM_REEL_WIDTH, Math.max(MINIMUM_REEL_WIDTH, Math.round(value)));
}

function ensureFacebookSdk() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }

  const sdkWindow = window as FacebookSdkWindow;
  if (sdkWindow.FB?.XFBML?.parse) {
    return Promise.resolve();
  }

  if (facebookSdkPromise) {
    return facebookSdkPromise;
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

interface FacebookReelSdkEmbedProps {
  href: string;
  preferredWidth?: number;
}

export default function FacebookReelSdkEmbed({ href, preferredWidth = MAXIMUM_REEL_WIDTH }: FacebookReelSdkEmbedProps) {
  const safeHref = normalizeSafeHref(href);
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderWidth, setRenderWidth] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const availableWidth = host.getBoundingClientRect().width || DEFAULT_REEL_WIDTH;
    setRenderWidth(clampReelWidth(Math.min(availableWidth, preferredWidth)));
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
  }, [renderWidth, safeHref]);

  if (safeHref === "#") {
    return null;
  }

  const reservedHeight = Math.round((renderWidth || DEFAULT_REEL_WIDTH) * (16 / 9));

  return (
    <Box
      ref={hostRef}
      data-facebook-reel-sdk-embed="true"
      sx={{
        width: "100%",
        maxWidth: MAXIMUM_REEL_WIDTH,
        minHeight: reservedHeight,
        mx: "auto",
        overflow: "hidden"
      }}
    >
      {renderWidth ? (
        <div
          className="fb-video"
          data-href={safeHref}
          data-width={String(renderWidth)}
          data-show-text="false"
          data-allowfullscreen="true"
          data-autoplay="false"
        />
      ) : null}
    </Box>
  );
}
