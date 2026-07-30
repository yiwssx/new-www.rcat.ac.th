import { useMemo, useState, type ReactNode } from "react";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import { Box, type SxProps, type Theme } from "@mui/material";
import { styled } from "@mui/material/styles";
import { resolvePublicImageSource, type PublicImageAssetSource, type PublicImageIntent } from "./publicImageSources";
import { usePublicMediaLoading } from "./publicMediaLoadingState";
import { useNearViewportActivation } from "./useNearViewportActivation";

export type PublicImageLoadMode = "critical" | "eager" | "near-viewport";

const PublicImageElement = styled("img")({});

interface PublicResponsiveImageProps {
  alt: string;
  aspectRatio?: string | number;
  bypassPageMediaGate?: boolean;
  className?: string;
  decoding?: "async" | "auto" | "sync";
  fallback?: ReactNode;
  fill?: boolean;
  height?: number;
  imageSx?: SxProps<Theme>;
  imageClassName?: string;
  intrinsic?: boolean;
  intent: PublicImageIntent;
  loadMode?: PublicImageLoadMode;
  nearViewportMargin?: string;
  onError?: () => void;
  onLoad?: () => void;
  reservedMinHeight?: number | Record<string, number>;
  sizes?: string;
  source: string | PublicImageAssetSource | null | undefined;
  sx?: SxProps<Theme>;
  width?: number;
}

export default function PublicResponsiveImage({
  alt,
  aspectRatio,
  bypassPageMediaGate = false,
  className,
  decoding = "async",
  fallback,
  fill = false,
  height,
  imageSx,
  imageClassName,
  intrinsic = false,
  intent,
  loadMode = "near-viewport",
  nearViewportMargin = "320px 0px",
  onError,
  onLoad,
  reservedMinHeight,
  sizes,
  source,
  sx,
  width
}: PublicResponsiveImageProps) {
  const resolvedSource = useMemo(() => resolvePublicImageSource(source, intent), [intent, source]);
  const sourceKey = `${resolvedSource.src}|${resolvedSource.srcSet}`;
  const [failedSourceKey, setFailedSourceKey] = useState("");
  const { pageMediaAllowed } = usePublicMediaLoading();
  const allowed = bypassPageMediaGate || pageMediaAllowed;
  const isNearViewportMode = loadMode === "near-viewport";
  const { activated, rootRef } = useNearViewportActivation(allowed && isNearViewportMode, nearViewportMargin);
  const shouldLoad = allowed && (!isNearViewportMode || activated);
  const failed = failedSourceKey === sourceKey;
  const hasUsableSource = Boolean(resolvedSource.src) && !failed;
  const shouldRenderImage = shouldLoad && hasUsableSource;
  const loading = isNearViewportMode ? "lazy" : "eager";
  const fetchPriority = loadMode === "critical" ? "high" : isNearViewportMode ? "low" : "auto";
  const usesIntrinsicSizing = intrinsic && !fill;
  const rootSxItems = Array.isArray(sx) ? sx : sx ? [sx] : [];
  const imageSxItems = Array.isArray(imageSx) ? imageSx : imageSx ? [imageSx] : [];

  return (
    <Box
      ref={rootRef}
      className={className}
      data-public-responsive-image="true"
      data-public-image-intent={intent}
      data-public-image-load-mode={loadMode}
      data-public-image-active={shouldRenderImage ? "true" : "false"}
      data-public-image-aspect-ratio={aspectRatio}
      data-public-image-fill={fill ? "true" : "false"}
      data-public-image-layout={fill ? "fill" : usesIntrinsicSizing ? "intrinsic" : "responsive"}
      sx={[
        {
          position: "relative",
          display: "block",
          width: usesIntrinsicSizing ? "fit-content" : "100%",
          height: fill ? "100%" : undefined,
          maxWidth: usesIntrinsicSizing ? "100%" : undefined,
          maxHeight: usesIntrinsicSizing ? "inherit" : undefined,
          aspectRatio,
          minHeight: reservedMinHeight,
          overflow: "hidden"
        },
        ...rootSxItems
      ]}
    >
      {shouldRenderImage ? (
        <PublicImageElement
          className={imageClassName}
          src={resolvedSource.src}
          srcSet={resolvedSource.srcSet || undefined}
          sizes={resolvedSource.srcSet ? sizes : undefined}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding={decoding}
          fetchPriority={fetchPriority}
          data-public-responsive-image-element="true"
          onLoad={onLoad}
          onError={() => {
            setFailedSourceKey(sourceKey);
            onError?.();
          }}
          sx={[
            fill
              ? {
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  display: "block"
                }
              : {
                  width: usesIntrinsicSizing ? "auto" : "100%",
                  height: "auto",
                  maxWidth: usesIntrinsicSizing ? "100%" : undefined,
                  maxHeight: usesIntrinsicSizing ? "inherit" : undefined,
                  display: "block"
                },
            ...imageSxItems
          ]}
        />
      ) : failed || !resolvedSource.src ? (
        <Box
          role="img"
          aria-label={alt}
          data-public-image-fallback="true"
          sx={{
            position: fill ? "absolute" : "relative",
            inset: fill ? 0 : undefined,
            width: "100%",
            height: fill ? "100%" : undefined,
            minHeight: reservedMinHeight,
            display: "grid",
            placeItems: "center",
            color: "text.secondary",
            bgcolor: "background.default"
          }}
        >
          {fallback ?? <BrokenImageOutlinedIcon aria-hidden="true" />}
        </Box>
      ) : (
        <Box
          aria-hidden="true"
          data-public-image-placeholder="true"
          sx={{
            position: fill ? "absolute" : "relative",
            inset: fill ? 0 : undefined,
            width: "100%",
            height: fill ? "100%" : undefined,
            minHeight: reservedMinHeight,
            bgcolor: "rgba(31, 90, 44, 0.06)"
          }}
        />
      )}
    </Box>
  );
}
