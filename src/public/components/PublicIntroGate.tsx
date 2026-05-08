import { useState } from "react";
import { Box, Button, Container, Paper, Stack } from "@mui/material";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { alpha } from "@mui/material/styles";
import { normalizeSafeHref } from "../../utils/safeUrl";

const mockIntroImage = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff8e1"/>
      <stop offset="50%" stop-color="#f8e3a2"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="40%" r="45%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#d6a11a" stop-opacity="0.12"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect x="70" y="70" width="1460" height="760" rx="36" fill="none" stroke="#b88700" stroke-width="10"/>
  <rect x="105" y="105" width="1390" height="690" rx="28" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.9"/>
  <circle cx="800" cy="345" r="190" fill="url(#halo)" stroke="#b88700" stroke-width="6"/>
  <text x="800" y="335" text-anchor="middle" font-family="serif" font-size="58" font-weight="700" fill="#7a5900">MOCK IMAGE</text>
  <text x="800" y="405" text-anchor="middle" font-family="serif" font-size="34" fill="#7a5900">สำหรับวันสำคัญของสถาบันพระมหากษัตริย์</text>
  <text x="800" y="640" text-anchor="middle" font-family="sans-serif" font-size="42" font-weight="700" fill="#1f5a2c">พื้นที่แสดงภาพพิธีการ / ภาพเฉลิมพระเกียรติ</text>
</svg>
`)}`;

const introConfig = {
  enabled: true,
  storageKey: "public-intro-gate-mock-royal-occasion-2026",
  imageUrl: mockIntroImage,
  imageAlt: "ภาพตัวอย่างสำหรับหน้า Intro วันสำคัญ",
  primaryButtonLabel: "เข้าสู่เว็บไซต์หลัก",
  secondaryButtonLabel: "ไปยังหน้ากิจกรรมเฉลิมพระเกียรติ",
  secondaryButtonUrl: "https://example.com/royal-activity"
};

function getInitialVisibility() {
  if (!introConfig.enabled || typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(introConfig.storageKey) !== "dismissed";
  } catch {
    return true;
  }
}

export default function PublicIntroGate() {
  const [isVisible, setIsVisible] = useState(getInitialVisibility);

  function handleEnterSite() {
    try {
      window.sessionStorage.setItem(introConfig.storageKey, "dismissed");
    } catch {
      // Session storage can be unavailable in strict privacy modes; entry should still work.
    }

    setIsVisible(false);
  }

  if (!introConfig.enabled || !isVisible) {
    return null;
  }

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
              src={introConfig.imageUrl}
              alt={introConfig.imageAlt}
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
                maxWidth: { xs: 360, sm: 520, md: 620 },
                mx: "auto",
                flexWrap: "nowrap"
              }}
            >
              <Button
                component="a"
                href={normalizeSafeHref(introConfig.secondaryButtonUrl)}
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
                {introConfig.secondaryButtonLabel}
              </Button>
              <Button
                type="button"
                variant="contained"
                color="primary"
                size="medium"
                fullWidth
                startIcon={<LoginRoundedIcon />}
                onClick={handleEnterSite}
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
                {introConfig.primaryButtonLabel}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
