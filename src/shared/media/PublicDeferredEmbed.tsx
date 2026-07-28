import type { HTMLAttributeReferrerPolicy } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";
import { normalizeSafeResourceUrl } from "../../utils/safeUrlCore";
import { usePublicMediaLoading } from "./publicMediaLoadingState";
import { useNearViewportActivation } from "./useNearViewportActivation";

interface PublicDeferredEmbedProps {
  allow?: string;
  allowFullScreen?: boolean;
  bypassPageMediaGate?: boolean;
  frameBorder?: number | string;
  height?: number | string;
  loadMode?: "eager" | "near-viewport";
  nearViewportMargin?: string;
  referrerPolicy?: HTMLAttributeReferrerPolicy;
  scrolling?: "auto" | "no" | "yes";
  src: string;
  sx?: SxProps<Theme>;
  title: string;
  width?: number | string;
}

export default function PublicDeferredEmbed({
  allow,
  allowFullScreen,
  bypassPageMediaGate = false,
  frameBorder,
  height,
  loadMode = "near-viewport",
  nearViewportMargin = "480px 0px",
  referrerPolicy,
  scrolling,
  src,
  sx,
  title,
  width
}: PublicDeferredEmbedProps) {
  const safeSrc = normalizeSafeResourceUrl(src);
  const { pageMediaAllowed } = usePublicMediaLoading();
  const allowed = bypassPageMediaGate || pageMediaAllowed;
  const isNearViewportMode = loadMode === "near-viewport";
  const { activated, rootRef } = useNearViewportActivation(allowed && isNearViewportMode, nearViewportMargin);
  const shouldLoad = Boolean(safeSrc) && allowed && (!isNearViewportMode || activated);

  return (
    <Box
      ref={rootRef}
      data-public-deferred-embed="true"
      data-public-embed-load-mode={loadMode}
      data-public-embed-active={shouldLoad ? "true" : "false"}
      sx={[
        {
          position: "relative",
          overflow: "hidden",
          bgcolor: "rgba(31, 90, 44, 0.06)"
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
    >
      {shouldLoad ? (
        <iframe
          src={safeSrc}
          title={title}
          loading="lazy"
          allow={allow}
          allowFullScreen={allowFullScreen}
          referrerPolicy={referrerPolicy}
          scrolling={scrolling}
          frameBorder={frameBorder}
          width={width}
          height={height}
          data-public-deferred-embed-element="true"
          style={{
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
            border: 0
          }}
        />
      ) : (
        <Box
          aria-hidden="true"
          data-public-embed-placeholder="true"
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(31, 90, 44, 0.06)"
          }}
        />
      )}
    </Box>
  );
}
