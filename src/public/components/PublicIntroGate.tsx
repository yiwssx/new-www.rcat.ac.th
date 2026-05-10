import { useState } from "react";
import { Box, Button, Container, Paper, Stack } from "@mui/material";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { alpha } from "@mui/material/styles";
import type { HomepageIntroGateSettings } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";

function shouldShowIntroGate(settings?: HomepageIntroGateSettings) {
  return Boolean(settings?.enabled && settings.imageUrl.trim());
}

function getInitialVisibility(settings?: HomepageIntroGateSettings) {
  if (!settings || !shouldShowIntroGate(settings) || typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(settings.storageKey) !== "dismissed";
  } catch {
    return true;
  }
}

export default function PublicIntroGate({ settings }: { settings?: HomepageIntroGateSettings }) {
  const [isVisible, setIsVisible] = useState(() => getInitialVisibility(settings));
  const hasSecondaryButton = Boolean(settings?.secondaryButtonLabel.trim() && settings.secondaryButtonUrl.trim());

  function handleEnterSite() {
    try {
      if (settings?.storageKey) {
        window.sessionStorage.setItem(settings.storageKey, "dismissed");
      }
    } catch {
      // Session storage can be unavailable in strict privacy modes; entry should still work.
    }

    setIsVisible(false);
  }

  if (!settings || !shouldShowIntroGate(settings) || !isVisible) {
    return null;
  }

  const activeSettings = settings;

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
              component="img"
              src={activeSettings.imageUrl}
              alt={activeSettings.imageAlt}
              sx={{
                width: "100%",
                maxHeight: { xs: "70vh", sm: "74vh", md: "78vh", lg: "82vh" },
                objectFit: "contain",
                borderRadius: { xs: 1, md: 1.5 },
                bgcolor: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(184, 135, 0, 0.28)",
                boxShadow: "0 18px 46px rgba(122, 89, 0, 0.16)"
              }}
            />

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
