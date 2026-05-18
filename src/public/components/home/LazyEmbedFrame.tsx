import { useEffect, useRef, useState } from "react";
import type { HTMLAttributeReferrerPolicy } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";

interface LazyEmbedFrameProps {
  allow?: string;
  allowFullScreen?: boolean;
  referrerPolicy?: HTMLAttributeReferrerPolicy;
  src: string;
  sx?: SxProps<Theme>;
  title: string;
}

function shouldLoadEmbedImmediately() {
  return (
    typeof window === "undefined" ||
    typeof window.IntersectionObserver !== "function" ||
    window.IntersectionObserver.name === "NoopIntersectionObserver"
  );
}

export function LazyEmbedFrame({ allow, allowFullScreen, referrerPolicy, src, sx, title }: LazyEmbedFrameProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(shouldLoadEmbedImmediately);

  useEffect(() => {
    if (shouldLoad) {
      return undefined;
    }

    const root = rootRef.current;

    if (!root) {
      return undefined;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "600px 0px"
      }
    );

    observer.observe(root);

    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <Box ref={rootRef} sx={sx}>
      {shouldLoad ? (
        <Box
          component="iframe"
          src={src}
          title={title}
          loading="lazy"
          allow={allow}
          allowFullScreen={allowFullScreen}
          referrerPolicy={referrerPolicy}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0
          }}
        />
      ) : (
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(31, 90, 44, 0.08)"
          }}
        />
      )}
    </Box>
  );
}
