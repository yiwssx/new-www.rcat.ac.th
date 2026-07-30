import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import { Box, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { CarouselSlide } from "../../features/cms-carousel/types";
import { normalizeCarouselSlide } from "../../features/cms-carousel/normalization";
import { resolvePublicImageSource } from "../media/publicImageSources";

const MOBILE_IMAGE_MEDIA_QUERY = "(max-width: 600px)";
const DEFAULT_EMPTY_LABEL = "ยังไม่มีรูปภาพ";

type ImageLoading = "eager" | "lazy";
type ImageFetchPriority = "high" | "low" | "auto";

interface CarouselImageStageProps {
  slide: CarouselSlide;
  alt: string;
  loading?: ImageLoading;
  fetchPriority?: ImageFetchPriority;
  sizes?: string;
  emptyLabel?: string;
  stageSx?: SxProps<Theme>;
  shouldLoad?: boolean;
  onMainImageLoad?: () => void;
}

function getResponsiveSource(url: string) {
  return resolvePublicImageSource(url, "carousel");
}

export default function CarouselImageStage({
  slide,
  alt,
  loading = "lazy",
  fetchPriority = "auto",
  sizes = "(max-width: 900px) 100vw, 1280px",
  emptyLabel = DEFAULT_EMPTY_LABEL,
  stageSx,
  shouldLoad = true,
  onMainImageLoad
}: CarouselImageStageProps) {
  const normalizedSlide = useMemo(() => normalizeCarouselSlide(slide), [slide]);

  const desktopSource = useMemo(() => getResponsiveSource(normalizedSlide.imageUrl), [normalizedSlide.imageUrl]);

  const mobileSource = useMemo(
    () => getResponsiveSource(normalizedSlide.mobileImageUrl),
    [normalizedSlide.mobileImageUrl]
  );

  /*
   * ผูกสถานะการโหลดล้มเหลวกับ URL ปัจจุบันแทนการ reset state ใน useEffect
   * เมื่อผู้ใช้เปลี่ยนรูป sourceKey จะเปลี่ยน และ error ของรูปก่อนหน้าจะหมดผลทันที
   */
  const sourceKey = `${desktopSource.src}|${mobileSource.src}`;

  const [failedMobileSourceKey, setFailedMobileSourceKey] = useState("");
  const [failedMainSourceKey, setFailedMainSourceKey] = useState("");
  const [loadedMainSourceKey, setLoadedMainSourceKey] = useState("");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mainImageRef = useRef<HTMLImageElement | null>(null);
  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const mobileSourceFailed = failedMobileSourceKey === sourceKey;
  const imageFailed = failedMainSourceKey === sourceKey;
  const mainImageLoaded = loadedMainSourceKey === sourceKey;

  const fallbackSource = desktopSource.src || mobileSource.src;
  const fallbackSrcSet = desktopSource.src ? desktopSource.srcSet : mobileSource.srcSet;

  const usableMobileSource =
    !mobileSourceFailed && mobileSource.src && mobileSource.src !== fallbackSource ? mobileSource : null;

  const objectFit = normalizedSlide.imageFit === "fill" ? "cover" : "contain";

  const objectPosition = `${normalizedSlide.focalPointX}% ${normalizedSlide.focalPointY}%`;
  const backgroundColor = normalizedSlide.backgroundColor || "";

  const stageSxItems = Array.isArray(stageSx) ? stageSx : stageSx ? [stageSx] : [];

  const drawBlurBackground = useCallback(() => {
    const canvas = blurCanvasRef.current;
    const image = mainImageRef.current;
    const stage = stageRef.current;

    if (
      !canvas ||
      !image ||
      !stage ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0 ||
      stage.clientWidth <= 0 ||
      stage.clientHeight <= 0
    ) {
      return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = (width - drawWidth) * (normalizedSlide.focalPointX / 100);
    const drawY = (height - drawHeight) * (normalizedSlide.focalPointY / 100);

    try {
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    } catch {
      // The contained foreground remains usable if a browser blocks canvas drawing.
    }
  }, [normalizedSlide.focalPointX, normalizedSlide.focalPointY]);

  useEffect(() => {
    if (!mainImageLoaded || normalizedSlide.imageFit !== "fit-blur") {
      return undefined;
    }

    drawBlurBackground();

    if (typeof window.ResizeObserver === "function") {
      const observer = new window.ResizeObserver(drawBlurBackground);

      if (stageRef.current) {
        observer.observe(stageRef.current);
      }

      return () => observer.disconnect();
    }

    window.addEventListener("resize", drawBlurBackground);
    return () => window.removeEventListener("resize", drawBlurBackground);
  }, [drawBlurBackground, mainImageLoaded, normalizedSlide.imageFit]);

  function handleMainImageError() {
    const mobileViewport =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(MOBILE_IMAGE_MEDIA_QUERY).matches;

    /*
     * หากรูปเฉพาะมือถือเสีย ให้ตัด mobile source ออกก่อน
     * browser จะกลับไปใช้ desktop source จาก img โดยไม่แสดง fallback ทันที
     */
    if (mobileViewport && usableMobileSource) {
      setFailedMobileSourceKey(sourceKey);
      return;
    }

    /*
     * หากไม่มี source สำรอง หรือ desktop source เสีย
     * ให้แสดง accessible fallback
     */
    setFailedMainSourceKey(sourceKey);
  }

  function renderPicture() {
    return (
      <picture
        key={`main:${fallbackSource}:${usableMobileSource?.src || ""}`}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
          overflow: "hidden"
        }}
      >
        {usableMobileSource && (
          <source
            media={MOBILE_IMAGE_MEDIA_QUERY}
            srcSet={usableMobileSource.srcSet || usableMobileSource.src}
            sizes={sizes}
          />
        )}

        <Box
          component="img"
          src={fallbackSource}
          srcSet={fallbackSrcSet || undefined}
          sizes={sizes}
          alt={alt}
          loading={loading}
          fetchPriority={fetchPriority}
          decoding="async"
          onLoad={(event) => {
            mainImageRef.current = event.currentTarget as HTMLImageElement;
            setLoadedMainSourceKey(sourceKey);
            onMainImageLoad?.();
          }}
          onError={handleMainImageError}
          data-carousel-image-layer="main"
          data-carousel-object-fit={objectFit}
          data-carousel-object-position={objectPosition}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            objectFit,
            objectPosition,
            zIndex: 2,
            filter: normalizedSlide.imageFit === "fit-blur" ? "drop-shadow(0 10px 24px rgba(0, 0, 0, 0.22))" : "none"
          }}
        />
      </picture>
    );
  }

  return (
    <Box
      ref={stageRef}
      data-carousel-image-stage="true"
      data-carousel-image-fit={normalizedSlide.imageFit}
      data-carousel-focal-point={objectPosition}
      data-carousel-background-color={backgroundColor || "theme"}
      sx={[
        {
          position: "relative",
          width: "100%",
          height: "100%",
          minHeight: "inherit",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          isolation: "isolate",
          bgcolor: backgroundColor || "primary.dark"
        },
        ...stageSxItems
      ]}
    >
      {!shouldLoad ? (
        <Box
          aria-hidden="true"
          data-carousel-image-placeholder="true"
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: backgroundColor || "primary.dark"
          }}
        />
      ) : !imageFailed && fallbackSource ? (
        <>
          {normalizedSlide.imageFit === "fit-blur" && mainImageLoaded && (
            <>
              <canvas
                ref={blurCanvasRef}
                aria-hidden="true"
                data-carousel-image-layer="background"
                style={{
                  position: "absolute",
                  inset: "-8%",
                  width: "116%",
                  height: "116%",
                  display: "block",
                  filter: "blur(22px) saturate(0.9)",
                  opacity: 0.58,
                  transform: "scale(1.04)",
                  pointerEvents: "none",
                  userSelect: "none"
                }}
              />

              <Box
                aria-hidden="true"
                sx={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 1,
                  pointerEvents: "none",
                  background: "linear-gradient(180deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.2) 100%)"
                }}
              />
            </>
          )}

          {renderPicture()}
        </>
      ) : (
        <Stack
          role="img"
          aria-label={alt}
          data-carousel-image-fallback="true"
          spacing={1}
          sx={{
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 2,
            minHeight: 140,
            px: 2,
            py: 3,
            color: "common.white",
            textAlign: "center"
          }}
        >
          <BrokenImageOutlinedIcon
            sx={{
              fontSize: 42,
              opacity: 0.86
            }}
          />

          <Typography
            sx={{
              fontWeight: 800
            }}
          >
            {emptyLabel}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
