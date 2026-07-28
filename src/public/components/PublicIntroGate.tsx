import { useEffect, useMemo, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { alpha } from "@mui/material/styles";
import type { HomepageIntroGateSettings } from "../../types";
import PublicResponsiveImage from "../../shared/media/PublicResponsiveImage";
import { resolvePublicImageSource } from "../../shared/media/publicImageSources";
import { normalizeSafeHref } from "../../utils/safeUrl";
import {
  getInitialPublicIntroGateVisibility,
  getPublicIntroGateStorageKey,
  shouldShowPublicIntroGate
} from "./publicIntroGateState";

type IntroGateImageStatus = "loading" | "loaded" | "failed";

function isDismissedInSession(storageKey: string, dismissedKeys: ReadonlySet<string>) {
  if (dismissedKeys.has(storageKey)) {
    return true;
  }

  if (typeof window === "undefined") {
    return true;
  }

  try {
    return window.sessionStorage.getItem(storageKey) === "dismissed";
  } catch {
    return false;
  }
}

export default function PublicIntroGate({
  onDismiss,
  settings,
  visible
}: {
  onDismiss?: () => void;
  settings?: HomepageIntroGateSettings;
  visible?: boolean;
}) {
  const [dismissedKeys, setDismissedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [imageState, setImageState] = useState<{ src: string; status: IntroGateImageStatus }>({
    src: "",
    status: "failed"
  });
  const imageSrc = useMemo(() => resolvePublicImageSource(settings?.imageUrl, "intro-gate").src, [settings?.imageUrl]);
  const hasSafeImage = Boolean(imageSrc);
  const imageStatus = imageState.src === imageSrc ? imageState.status : hasSafeImage ? "loading" : "failed";
  const hasSecondaryButton = Boolean(settings?.secondaryButtonLabel.trim() && settings.secondaryButtonUrl.trim());
  const storageKey = getPublicIntroGateStorageKey(settings);
  const uncontrolledVisibility =
    getInitialPublicIntroGateVisibility(settings) && !isDismissedInSession(storageKey, dismissedKeys);
  const isVisible = visible ?? uncontrolledVisibility;

  useEffect(() => {
    if (!isVisible || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const scrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isVisible]);

  function handleEnterSite() {
    try {
      window.sessionStorage.setItem(storageKey, "dismissed");
    } catch {
      // Session storage can be unavailable in strict privacy modes; entry should still work.
    }

    setDismissedKeys((current) => new Set(current).add(storageKey));
    onDismiss?.();
  }

  if (!settings || !shouldShowPublicIntroGate(settings) || !isVisible) {
    return null;
  }

  const activeSettings = settings;
  const showImageLoadingState = hasSafeImage && imageStatus === "loading";
  const showImageErrorState = !hasSafeImage || imageStatus === "failed";

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-label="หน้าแนะนำก่อนเข้าสู่เว็บไซต์"
      sx={(theme) => ({
        position: "fixed",
        inset: 0,
        zIndex: theme.zIndex.modal + 20,
        width: "100vw",
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: alpha(theme.palette.common.black, 0.82),
        px: { xs: 1, sm: 2 },
        py: { xs: 1, sm: 2 },
        overflow: "hidden",
        overscrollBehavior: "none",
        touchAction: "none"
      })}
    >
      <Stack
        spacing={{ xs: 1, sm: 1.25 }}
        alignItems="center"
        justifyContent="center"
        sx={{
          width: "100%",
          height: "100%",
          maxWidth: "100vw",
          maxHeight: "100dvh"
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "min(96vw, 960px)",
            height: hasSecondaryButton ? "calc(100dvh - 132px)" : "calc(100dvh - 92px)",
            maxHeight: 720,
            overflow: "hidden",
            borderRadius: { xs: 1.5, sm: 2 },
            bgcolor: "transparent",
            boxShadow: "0 24px 80px rgba(0,0,0,0.46)"
          }}
        >
          {showImageLoadingState && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: { xs: 1.5, sm: 2 },
                bgcolor: "rgba(255,255,255,0.1)"
              }}
            >
              <Typography
                aria-live="polite"
                sx={{
                  px: 2,
                  py: 4,
                  fontSize: { xs: "0.9rem", sm: "1rem" },
                  fontWeight: 700,
                  color: "#fff",
                  textAlign: "center"
                }}
              >
                กำลังโหลดภาพประชาสัมพันธ์
              </Typography>
            </Box>
          )}

          {showImageErrorState && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: { xs: 1.5, sm: 2 },
                bgcolor: "rgba(255,255,255,0.1)"
              }}
            >
              <Typography
                role="status"
                sx={{
                  px: 2,
                  py: 4,
                  fontSize: { xs: "0.9rem", sm: "1rem" },
                  fontWeight: 700,
                  color: "#fff",
                  textAlign: "center"
                }}
              >
                ไม่สามารถโหลดภาพประชาสัมพันธ์ได้
              </Typography>
            </Box>
          )}

          {hasSafeImage && imageStatus !== "failed" && (
            <PublicResponsiveImage
              source={activeSettings.imageUrl}
              intent="intro-gate"
              sizes="96vw"
              alt={activeSettings.imageAlt}
              loadMode="critical"
              bypassPageMediaGate
              fill
              onLoad={() => setImageState({ src: imageSrc, status: "loaded" })}
              onError={() => setImageState({ src: imageSrc, status: "failed" })}
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: imageStatus === "loaded" ? 1 : 0,
                transition: "opacity 180ms ease",
                pointerEvents: "auto"
              }}
              imageSx={{
                objectFit: "contain",
                borderRadius: { xs: 1.5, sm: 2 }
              }}
            />
          )}
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 0.75, sm: 1 }}
          justifyContent="center"
          alignItems="stretch"
          sx={{
            width: "100%",
            maxWidth: hasSecondaryButton ? { xs: "96vw", sm: 560 } : { xs: "96vw", sm: 320 },
            flexShrink: 0,
            pointerEvents: "auto"
          }}
        >
          {hasSecondaryButton && (
            <Button
              component="a"
              href={normalizeSafeHref(activeSettings.secondaryButtonUrl)}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
              color="inherit"
              size="large"
              fullWidth
              endIcon={<OpenInNewRoundedIcon />}
              sx={(theme) => ({
                minHeight: 46,
                fontWeight: 800,
                bgcolor: alpha(theme.palette.common.white, 0.96),
                borderColor: alpha(theme.palette.common.white, 0.8),
                color: theme.palette.primary.dark,
                "&:hover": {
                  bgcolor: theme.palette.common.white,
                  borderColor: theme.palette.common.white
                }
              })}
            >
              {activeSettings.secondaryButtonLabel}
            </Button>
          )}

          <Button
            type="button"
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            startIcon={<LoginRoundedIcon />}
            onClick={handleEnterSite}
            sx={{
              minHeight: 46,
              fontWeight: 900,
              boxShadow: "0 10px 30px rgba(0,0,0,0.32)"
            }}
          >
            {activeSettings.primaryButtonLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
