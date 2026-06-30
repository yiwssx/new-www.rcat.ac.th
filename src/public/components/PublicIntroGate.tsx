import { useMemo, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { alpha } from "@mui/material/styles";
import type { HomepageIntroGateSettings } from "../../types";
import { getPublicImageSrcSet, normalizePublicImageUrl, normalizeSafeHref } from "../../utils/safeUrl";

const DEFAULT_INTRO_GATE_STORAGE_KEY = "public-intro-gate";
type IntroGateImageStatus = "loading" | "loaded" | "failed";

function shouldShowIntroGate(settings?: HomepageIntroGateSettings) {
  return Boolean(settings?.enabled && settings.imageUrl.trim());
}

function getIntroGateStorageKey(settings?: HomepageIntroGateSettings) {
  return settings?.storageKey.trim() || DEFAULT_INTRO_GATE_STORAGE_KEY;
}

function getInitialVisibility(settings?: HomepageIntroGateSettings) {
  if (!settings || !shouldShowIntroGate(settings) || typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(getIntroGateStorageKey(settings)) !== "dismissed";
  } catch {
    return true;
  }
}

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

export default function PublicIntroGate({ settings }: { settings?: HomepageIntroGateSettings }) {
  const [dismissedKeys, setDismissedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [imageState, setImageState] = useState<{ src: string; status: IntroGateImageStatus }>({
    src: "",
    status: "failed"
  });
  const imageSrc = useMemo(() => normalizePublicImageUrl(settings?.imageUrl), [settings?.imageUrl]);
  const imageSrcSet = useMemo(() => getPublicImageSrcSet(settings?.imageUrl), [settings?.imageUrl]);
  const hasSafeImage = Boolean(imageSrc);
  const imageStatus = imageState.src === imageSrc ? imageState.status : hasSafeImage ? "loading" : "failed";
  const hasSecondaryButton = Boolean(settings?.secondaryButtonLabel.trim() && settings.secondaryButtonUrl.trim());
  const storageKey = getIntroGateStorageKey(settings);
  const isVisible = getInitialVisibility(settings) && !isDismissedInSession(storageKey, dismissedKeys);

  function handleEnterSite() {
    try {
      window.sessionStorage.setItem(storageKey, "dismissed");
    } catch {
      // Session storage can be unavailable in strict privacy modes; entry should still work.
    }

    setDismissedKeys((current) => new Set(current).add(storageKey));
  }

  if (!settings || !shouldShowIntroGate(settings) || !isVisible) {
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
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        bgcolor: alpha(theme.palette.common.black, 0.72),
        background: `linear-gradient(145deg, ${alpha(theme.palette.primary.dark, 0.88)} 0%, ${alpha(
          theme.palette.common.black,
          0.72
        )} 48%, ${alpha(theme.palette.secondary.dark, 0.72)} 100%)`,
        px: { xs: 1, sm: 2, md: 3 },
        py: { xs: 1.25, sm: 2, md: 3 },
        overflow: "auto"
      })}
    >
      <Stack
        spacing={{ xs: 1, sm: 1.25, md: 1.5 }}
        alignItems="center"
        sx={{
          width: "100%",
          maxWidth: { xs: "100%", sm: 760, md: 980, lg: 1180, xl: 1320 },
          mx: "auto"
        }}
      >
        <Box
          sx={(theme) => ({
            position: "relative",
            display: "grid",
            placeItems: "center",
            width: "100%",
            maxHeight: { xs: "78dvh", sm: "80dvh", md: "82dvh" },
            overflow: "hidden",
            borderRadius: { xs: 1.25, sm: 2, md: 2.5 },
            bgcolor: alpha(theme.palette.common.white, 0.96),
            border: `1px solid ${alpha(theme.palette.common.white, 0.38)}`,
            boxShadow: `0 28px 90px ${alpha(theme.palette.common.black, 0.38)}`,
            color: "text.secondary",
            textAlign: "center",
            "&::before": showImageLoadingState
              ? {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(110deg, ${alpha(theme.palette.common.white, 0.24)} 8%, ${alpha(
                    theme.palette.secondary.light,
                    0.36
                  )} 18%, ${alpha(theme.palette.common.white, 0.24)} 33%)`,
                  backgroundSize: "200% 100%",
                  animation: "introGateImageLoading 1.35s ease-in-out infinite"
                }
              : undefined,
            "@keyframes introGateImageLoading": {
              "0%": {
                backgroundPosition: "100% 0"
              },
              "100%": {
                backgroundPosition: "-100% 0"
              }
            }
          })}
        >
          {showImageLoadingState && (
            <Typography
              aria-live="polite"
              sx={{
                position: "relative",
                zIndex: 1,
                px: 2,
                py: 8,
                fontSize: { xs: "0.86rem", sm: "0.95rem" },
                fontWeight: 700
              }}
            >
              กำลังโหลดภาพประชาสัมพันธ์
            </Typography>
          )}

          {showImageErrorState && (
            <Typography
              role="status"
              sx={{
                px: 2,
                py: 8,
                fontSize: { xs: "0.86rem", sm: "0.95rem" },
                fontWeight: 700
              }}
            >
              ไม่สามารถโหลดภาพประชาสัมพันธ์ได้
            </Typography>
          )}

          {hasSafeImage && imageStatus !== "failed" && (
            <Box
              component="img"
              src={imageSrc}
              srcSet={imageSrcSet || undefined}
              sizes="(max-width: 600px) 96vw, (max-width: 1200px) 94vw, 1320px"
              alt={activeSettings.imageAlt}
              loading="eager"
              decoding="async"
              onLoad={() => setImageState({ src: imageSrc, status: "loaded" })}
              onError={() => setImageState({ src: imageSrc, status: "failed" })}
              {...({ fetchpriority: "high" } as Record<string, string>)}
              sx={{
                display: "block",
                width: "100%",
                height: "auto",
                maxHeight: { xs: "78dvh", sm: "80dvh", md: "82dvh" },
                objectFit: "contain",
                opacity: imageStatus === "loaded" ? 1 : 0,
                transition: "opacity 180ms ease"
              }}
            />
          )}
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 0.75, sm: 1, md: 1.25 }}
          justifyContent="center"
          alignItems="stretch"
          sx={{
            width: "100%",
            maxWidth: hasSecondaryButton ? { xs: "100%", sm: 560, md: 680 } : { xs: "100%", sm: 340 },
            mx: "auto"
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
                minHeight: { xs: 44, sm: 46, md: 48 },
                px: { xs: 1.5, sm: 2, md: 2.5 },
                fontSize: { xs: "0.86rem", sm: "0.92rem", md: "0.98rem" },
                fontWeight: 800,
                bgcolor: alpha(theme.palette.common.white, 0.92),
                borderColor: alpha(theme.palette.common.white, 0.72),
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
              minHeight: { xs: 44, sm: 46, md: 48 },
              px: { xs: 1.5, sm: 2, md: 2.5 },
              fontSize: { xs: "0.86rem", sm: "0.92rem", md: "0.98rem" },
              fontWeight: 900,
              boxShadow: "0 14px 32px rgba(0,0,0,0.28)"
            }}
          >
            {activeSettings.primaryButtonLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
