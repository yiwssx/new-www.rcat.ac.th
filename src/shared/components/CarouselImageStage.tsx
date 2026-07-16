import { useMemo, useState } from "react";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import { Box, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { CarouselSlide } from "../../features/cms-carousel/types";
import { normalizeCarouselSlide } from "../../features/cms-carousel/normalization";
import { getPublicImageSrcSet, normalizePublicImageUrl } from "../../utils/safeUrl";

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
}

function getResponsiveSource(url: string) {
  if (!url) {
    return {
      src: "",
      srcSet: ""
    };
  }

  return {
    src: normalizePublicImageUrl(url),
    srcSet: getPublicImageSrcSet(url)
  };
}

export default function CarouselImageStage({
  slide,
  alt,
  loading = "lazy",
  fetchPriority = "auto",
  sizes = "(max-width: 900px) 100vw, 1280px",
  emptyLabel = DEFAULT_EMPTY_LABEL,
  stageSx
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

  const mobileSourceFailed = failedMobileSourceKey === sourceKey;
  const imageFailed = failedMainSourceKey === sourceKey;

  const fallbackSource = desktopSource.src || mobileSource.src;
  const fallbackSrcSet = desktopSource.src ? desktopSource.srcSet : mobileSource.srcSet;

  const usableMobileSource =
    !mobileSourceFailed && mobileSource.src && mobileSource.src !== fallbackSource ? mobileSource : null;

  const objectFit = normalizedSlide.imageFit === "fill" ? "cover" : "contain";

  const objectPosition = `${normalizedSlide.focalPointX}% ${normalizedSlide.focalPointY}%`;
  const backgroundColor = normalizedSlide.backgroundColor || "";

  const stageSxItems = Array.isArray(stageSx) ? stageSx : stageSx ? [stageSx] : [];

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

  function renderPicture(layer: "background" | "main") {
    const isBackground = layer === "background";

    return (
      <picture
        key={`${layer}:${fallbackSource}:${usableMobileSource?.src || ""}`}
        aria-hidden={isBackground ? "true" : undefined}
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
          alt={isBackground ? "" : alt}
          aria-hidden={isBackground ? "true" : undefined}
          loading={loading}
          {...(!isBackground
            ? ({
                fetchpriority: fetchPriority
              } as Record<string, string>)
            : ({} as Record<string, string>))}
          decoding="async"
          onError={isBackground ? undefined : handleMainImageError}
          data-carousel-image-layer={layer}
          data-carousel-object-fit={isBackground ? "cover" : objectFit}
          data-carousel-object-position={objectPosition}
          sx={
            isBackground
              ? {
                  position: "absolute",
                  inset: "-8%",
                  width: "116%",
                  height: "116%",
                  display: "block",
                  objectFit: "cover",
                  objectPosition,
                  filter: "blur(22px) saturate(0.9)",
                  opacity: 0.58,
                  transform: "scale(1.04)",
                  pointerEvents: "none",
                  userSelect: "none"
                }
              : {
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit,
                  objectPosition,
                  zIndex: 2,
                  filter:
                    normalizedSlide.imageFit === "fit-blur" ? "drop-shadow(0 10px 24px rgba(0, 0, 0, 0.22))" : "none"
                }
          }
        />
      </picture>
    );
  }

  return (
    <Box
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
      {!imageFailed && fallbackSource ? (
        <>
          {normalizedSlide.imageFit === "fit-blur" && (
            <>
              {renderPicture("background")}

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

          {renderPicture("main")}
        </>
      ) : (
        <Stack
          role="img"
          aria-label={alt}
          data-carousel-image-fallback="true"
          spacing={1}
          alignItems="center"
          justifyContent="center"
          sx={{
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

          <Typography fontWeight={800}>{emptyLabel}</Typography>
        </Stack>
      )}
    </Box>
  );
}
