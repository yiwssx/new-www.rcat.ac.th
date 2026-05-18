import { useMemo, useState } from "react";
import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
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
        bgcolor: "background.default",
        background: `radial-gradient(circle at top, ${alpha(theme.palette.secondary.light, 0.55)} 0%, ${theme.palette.background.default} 48%, ${alpha(theme.palette.primary.light, 0.38)} 100%)`,
        px: { xs: 1.5, sm: 2 },
        py: { xs: 2, md: 4 },
        overflowY: "auto"
      })}
    >
      <Container maxWidth="xl">
        <Paper
          elevation={0}
          sx={(theme) => ({
            borderRadius: { xs: 1.5, md: 2 },
            border: `1px solid ${alpha(theme.palette.secondary.dark, 0.24)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.92),
            boxShadow: `0 26px 80px ${alpha(theme.palette.primary.dark, 0.18)}`,
            px: { xs: 0.75, sm: 1.25, md: 1.5 },
            py: { xs: 1, md: 1.5 }
          })}
        >
          <Stack spacing={{ xs: 1, md: 1.4 }} alignItems="center">
            <Box
              sx={(theme) => ({
                position: "relative",
                display: "grid",
                placeItems: "center",
                width: "100%",
                minHeight: { xs: 220, sm: 280, md: 340 },
                maxHeight: { xs: "70vh", sm: "74vh", md: "78vh", lg: "82vh" },
                overflow: "hidden",
                borderRadius: { xs: 1, md: 1.5 },
                bgcolor: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(184, 135, 0, 0.28)",
                boxShadow: "0 18px 46px rgba(122, 89, 0, 0.16)",
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
                  sizes="(max-width: 600px) 94vw, (max-width: 1200px) 92vw, 1280px"
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
                    maxHeight: { xs: "70vh", sm: "74vh", md: "78vh", lg: "82vh" },
                    objectFit: "contain",
                    opacity: imageStatus === "loaded" ? 1 : 0,
                    transition: "opacity 160ms ease"
                  }}
                />
              )}
            </Box>

            <Stack
              direction="row"
              spacing={{ xs: 0.75, sm: 1, md: 1.2 }}
              justifyContent="center"
              alignItems="stretch"
              sx={{
                width: "100%",
                maxWidth: hasSecondaryButton ? { xs: 360, sm: 520, md: 620 } : { xs: 280, sm: 320 },
                mx: "auto",
                flexWrap: "nowrap"
              }}
            >
              {hasSecondaryButton && (
                <Button
                  component="a"
                  href={normalizeSafeHref(activeSettings.secondaryButtonUrl)}
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                  color="primary"
                  size="medium"
                  fullWidth
                  endIcon={<OpenInNewRoundedIcon />}
                  sx={{
                    minWidth: 0,
                    flex: "1 1 0",
                    minHeight: { xs: 36, sm: 40, md: 46 },
                    px: { xs: 0.75, sm: 1.4, md: 2.4 },
                    fontSize: { xs: "0.72rem", sm: "0.84rem", md: "0.95rem" },
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    "& .MuiButton-startIcon, & .MuiButton-endIcon": {
                      mx: { xs: 0.25, sm: 0.5 },
                      "& svg": {
                        fontSize: { xs: "1rem", sm: "1.1rem", md: "1.25rem" }
                      }
                    }
                  }}
                >
                  {activeSettings.secondaryButtonLabel}
                </Button>
              )}
              <Button
                type="button"
                variant="contained"
                color="primary"
                size="medium"
                fullWidth={hasSecondaryButton}
                startIcon={<LoginRoundedIcon />}
                onClick={handleEnterSite}
                sx={{
                  minWidth: 0,
                  flex: hasSecondaryButton ? "1 1 0" : "0 1 auto",
                  minHeight: { xs: 36, sm: 40, md: 46 },
                  px: { xs: 0.75, sm: 1.4, md: 2.4 },
                  fontSize: { xs: "0.72rem", sm: "0.84rem", md: "0.95rem" },
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  "& .MuiButton-startIcon, & .MuiButton-endIcon": {
                    mx: { xs: 0.25, sm: 0.5 },
                    "& svg": {
                      fontSize: { xs: "1rem", sm: "1.1rem", md: "1.25rem" }
                    }
                  }
                }}
              >
                {activeSettings.primaryButtonLabel}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
