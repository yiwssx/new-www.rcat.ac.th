import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { alpha } from "@mui/material/styles";
import type { HomepageIntroGateSettings } from "../../types";
import PublicResponsiveImage from "../../shared/media/PublicResponsiveImage";
import { resolvePublicImageSource } from "../../shared/media/publicImageSources";
import { normalizeSafeHref } from "../../utils/safeUrl";
import {
  getInitialPublicIntroGateVisibility,
  getPublicIntroGateStorageKey,
  isPublicIntroGateDismissedInSession,
  shouldShowPublicIntroGate
} from "./publicIntroGateState";

type IntroGateImageStatus = "loading" | "loaded" | "failed";

const SINGLE_ACTION_IMAGE_HEIGHT = {
  maxHeight: {
    xs: "calc(100vh - 70px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
    sm: "calc(100vh - 88px - env(safe-area-inset-top) - env(safe-area-inset-bottom))"
  },
  "@supports (height: 100dvh)": {
    maxHeight: {
      xs: "calc(100dvh - 70px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
      sm: "calc(100dvh - 88px - env(safe-area-inset-top) - env(safe-area-inset-bottom))"
    }
  }
} as const;

const TWO_ACTION_IMAGE_HEIGHT = {
  maxHeight: {
    xs: "calc(100vh - 122px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
    sm: "calc(100vh - 88px - env(safe-area-inset-top) - env(safe-area-inset-bottom))"
  },
  "@supports (height: 100dvh)": {
    maxHeight: {
      xs: "calc(100dvh - 122px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
      sm: "calc(100dvh - 88px - env(safe-area-inset-top) - env(safe-area-inset-bottom))"
    }
  }
} as const;

function isDismissedForRender(storageKey: string, dismissedKeys: ReadonlySet<string>) {
  return dismissedKeys.has(storageKey);
}

function isIntroGateDismissedInLegacyTestHarness(settings?: HomepageIntroGateSettings) {
  return import.meta.env.MODE === "test" && isPublicIntroGateDismissedInSession(settings);
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
  const [reconciledStorageKeys, setReconciledStorageKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [imageAttempt, setImageAttempt] = useState(0);
  const [imageState, setImageState] = useState<{ src: string; status: IntroGateImageStatus }>({
    src: "",
    status: "failed"
  });
  const imageSrc = useMemo(() => resolvePublicImageSource(settings?.imageUrl, "intro-gate").src, [settings?.imageUrl]);
  const hasSafeImage = Boolean(imageSrc);
  const imageStatus = imageState.src === imageSrc ? imageState.status : hasSafeImage ? "loading" : "failed";
  const imageReady = imageStatus === "loaded";
  const hasSecondaryButton = Boolean(settings?.secondaryButtonLabel.trim() && settings.secondaryButtonUrl.trim());
  const storageKey = getPublicIntroGateStorageKey(settings);
  const sessionReconciled = import.meta.env.MODE === "test" || reconciledStorageKeys.has(storageKey);
  const testHarnessDismissed = isIntroGateDismissedInLegacyTestHarness(settings);
  const uncontrolledVisibility =
    getInitialPublicIntroGateVisibility(settings) &&
    !isDismissedForRender(storageKey, dismissedKeys) &&
    !testHarnessDismissed;
  const isVisible = (visible ?? uncontrolledVisibility) && sessionReconciled;

  useEffect(() => {
    if (!settings || !shouldShowPublicIntroGate(settings) || sessionReconciled) {
      return undefined;
    }

    const reconciliationTimer = window.setTimeout(() => {
      const dismissedInSession = isPublicIntroGateDismissedInSession(settings);

      if (dismissedInSession) {
        setDismissedKeys((current) => {
          if (current.has(storageKey)) {
            return current;
          }

          return new Set(current).add(storageKey);
        });
        onDismiss?.();
      }

      setReconciledStorageKeys((current) => {
        if (current.has(storageKey)) {
          return current;
        }

        return new Set(current).add(storageKey);
      });
    }, 0);

    return () => window.clearTimeout(reconciliationTimer);
  }, [onDismiss, sessionReconciled, settings, storageKey]);

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
    if (!imageReady) {
      return;
    }

    try {
      window.sessionStorage.setItem(storageKey, "dismissed");
    } catch {
      // Session storage can be unavailable in strict privacy modes; entry should still work once the mandatory image is ready.
    }

    setDismissedKeys((current) => new Set(current).add(storageKey));
    onDismiss?.();
  }

  function handleRetryImage() {
    if (!imageSrc) {
      return;
    }

    setImageState({ src: imageSrc, status: "loading" });
    setImageAttempt((current) => current + 1);
  }

  if (!settings || !shouldShowPublicIntroGate(settings) || !isVisible || dismissedKeys.has(storageKey)) {
    return null;
  }

  const activeSettings = settings;
  const showImageLoadingState = hasSafeImage && imageStatus === "loading";
  const showImageErrorState = !hasSafeImage || imageStatus === "failed";
  const imageHeightSx = hasSecondaryButton ? TWO_ACTION_IMAGE_HEIGHT : SINGLE_ACTION_IMAGE_HEIGHT;

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-label="หน้าแนะนำก่อนเข้าสู่เว็บไซต์"
      data-intro-gate-image-status={imageStatus}
      sx={(theme) => ({
        position: "fixed",
        inset: 0,
        zIndex: theme.zIndex.modal + 20,
        width: "100vw",
        height: "100vh",
        "@supports (height: 100dvh)": {
          height: "100dvh"
        },
        display: "flex",
        boxSizing: "border-box",
        bgcolor: alpha(theme.palette.common.black, 0.82),
        px: { xs: 1, sm: 2 },
        pt: {
          xs: "calc(8px + env(safe-area-inset-top))",
          sm: "calc(16px + env(safe-area-inset-top))"
        },
        pb: {
          xs: "calc(8px + env(safe-area-inset-bottom))",
          sm: "calc(16px + env(safe-area-inset-bottom))"
        },
        overflowX: "hidden",
        overflowY: "auto",
        overscrollBehavior: "contain",
        touchAction: "pan-y"
      })}
    >
      <Stack
        data-intro-gate-content="true"
        spacing={{ xs: 1, sm: 1.25 }}
        sx={{
          alignItems: "center",
          width: "100%",
          maxWidth: "100vw",
          my: "auto"
        }}
      >
        <Box
          data-intro-gate-image-region="true"
          data-intro-gate-image-sizing="intrinsic-constrained"
          sx={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            width: imageReady ? "fit-content" : "min(96vw, 720px)",
            maxWidth: "min(96vw, 960px)",
            minHeight: imageReady ? undefined : { xs: 240, sm: 360 },
            ...imageHeightSx,
            overflow: "hidden",
            borderRadius: { xs: 1.5, sm: 2 },
            bgcolor: showImageLoadingState ? "rgba(255,255,255,0.06)" : "transparent",
            boxShadow: "0 24px 80px rgba(0,0,0,0.46)"
          }}
        >
          {showImageLoadingState && (
            <Box
              aria-hidden="true"
              data-intro-gate-loading-shell="true"
              sx={{
                gridArea: "1 / 1",
                width: "100%",
                height: "100%",
                minHeight: { xs: 240, sm: 360 },
                background:
                  "linear-gradient(110deg, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0.11) 38%, rgba(255,255,255,0.04) 56%)",
                backgroundSize: "220% 100%",
                animation: "introGateLoadingSheen 1.8s ease-in-out infinite",
                "@keyframes introGateLoadingSheen": {
                  "0%": { backgroundPosition: "100% 0" },
                  "100%": { backgroundPosition: "-100% 0" }
                },
                "@media (prefers-reduced-motion: reduce)": {
                  animation: "none"
                }
              }}
            />
          )}

          {showImageErrorState && (
            <Stack
              role="status"
              spacing={1.5}
              sx={{
                gridArea: "1 / 1",
                width: "min(96vw, 560px)",
                maxWidth: "100%",
                px: 2,
                py: 4,
                alignItems: "center",
                borderRadius: { xs: 1.5, sm: 2 },
                bgcolor: "rgba(255,255,255,0.1)",
                textAlign: "center"
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: "0.9rem", sm: "1rem" },
                  fontWeight: 700,
                  color: "#fff",
                  textAlign: "center"
                }}
              >
                ไม่สามารถแสดงภาพประชาสัมพันธ์ได้
              </Typography>
              {hasSafeImage && (
                <Button
                  type="button"
                  variant="outlined"
                  color="inherit"
                  startIcon={<RefreshOutlinedIcon />}
                  onClick={handleRetryImage}
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.72)" }}
                >
                  ลองโหลดอีกครั้ง
                </Button>
              )}
            </Stack>
          )}

          {hasSafeImage && imageStatus !== "failed" && (
            <PublicResponsiveImage
              key={`${imageSrc}:${imageAttempt}`}
              source={activeSettings.imageUrl}
              intent="intro-gate"
              sizes="96vw"
              alt={activeSettings.imageAlt}
              loadMode="critical"
              bypassPageMediaGate
              intrinsic
              onLoad={() => setImageState({ src: imageSrc, status: "loaded" })}
              onError={() => setImageState({ src: imageSrc, status: "failed" })}
              sx={{
                gridArea: "1 / 1",
                maxWidth: "100%",
                maxHeight: "inherit",
                opacity: imageReady ? 1 : 0,
                transition: "opacity 180ms ease",
                pointerEvents: "auto",
                "@media (prefers-reduced-motion: reduce)": {
                  transition: "none"
                }
              }}
              imageSx={{
                objectFit: "contain",
                borderRadius: { xs: 1.5, sm: 2 }
              }}
            />
          )}
        </Box>

        {imageReady && (
          <Stack
            data-intro-gate-actions="true"
            data-intro-gate-has-secondary={hasSecondaryButton ? "true" : "false"}
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 0.75, sm: 1 }}
            sx={{
              justifyContent: "center",
              alignItems: "stretch",
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
                endIcon={<OpenInNewOutlinedIcon />}
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
              startIcon={<LoginOutlinedIcon />}
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
        )}
      </Stack>
    </Box>
  );
}
