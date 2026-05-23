import { Box, Chip, Container, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { keyframes } from "@emotion/react";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import type { HomepageMarqueeSettings } from "../../../types";

const defaultMarqueeSpeedSeconds = 60;

const marqueeScroll = keyframes`
  from {
    transform: translate3d(0, 0, 0);
  }

  to {
    transform: translate3d(-50%, 0, 0);
  }
`;

function getMarqueeSpeedSeconds(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return defaultMarqueeSpeedSeconds;
  }

  return Math.min(180, Math.max(24, numericValue));
}

function getReducedMotionMarqueeSpeedSeconds(speedSeconds: number) {
  return Math.min(240, Math.max(speedSeconds * 2, 120));
}

export function UrgentMarqueeSection({ settings }: { settings?: HomepageMarqueeSettings }) {
  if (!settings?.enabled || !settings.text.trim()) {
    return null;
  }

  const marqueeText = settings.text.trim();
  const speedSeconds = getMarqueeSpeedSeconds(settings.speedSeconds);
  const reducedMotionSpeedSeconds = getReducedMotionMarqueeSpeedSeconds(speedSeconds);
  const tickerItems = [marqueeText, marqueeText, marqueeText];

  return (
    <Box component="section" aria-label="ประกาศด่วน" sx={{ py: { xs: 1, md: 1.2 }, bgcolor: "background.default" }}>
      <Container maxWidth="xl">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 0.8, sm: 1.4 }}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={(theme) => ({
            overflow: "hidden",
            borderRadius: 1.5,
            border: "1px solid rgba(197, 133, 0, 0.26)",
            bgcolor: alpha(theme.palette.secondary.light, 0.36),
            boxShadow: "0 8px 22px rgba(31, 90, 44, 0.08)",
            px: { xs: 1.2, sm: 1.5, md: 2 },
            py: { xs: 0.85, md: 0.95 },
            "&:hover .marqueeTrack": {
              animationPlayState: "paused"
            },
            "@media (prefers-reduced-motion: reduce)": {
              "& .marqueeTrack": {
                // This is an urgent public notice, so reduced motion slows the ticker instead of stopping it.
                animationDuration: `${reducedMotionSpeedSeconds}s`
              }
            }
          })}
        >
          <Chip
            icon={<CampaignOutlinedIcon />}
            label={settings.label}
            color="secondary"
            sx={{
              alignSelf: { xs: "flex-start", sm: "center" },
              flexShrink: 0,
              color: "secondary.contrastText",
              fontWeight: 900,
              "& .MuiChip-icon": {
                color: "secondary.contrastText"
              }
            }}
          />
          <Box sx={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
            <Box
              className="marqueeTrack"
              sx={{
                display: "flex",
                width: "max-content",
                whiteSpace: "nowrap",
                animationName: `${marqueeScroll}`,
                animationDuration: `${speedSeconds}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDelay: "0s",
                willChange: "transform"
              }}
            >
              {[false, true].map((isDuplicate) => (
                <Box
                  key={isDuplicate ? "duplicate" : "primary"}
                  data-testid="urgent-marquee-group"
                  aria-hidden={isDuplicate ? "true" : undefined}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    pr: { xs: 4, md: 6 }
                  }}
                >
                  {tickerItems.map((item, index) => (
                    <Typography
                      key={`${isDuplicate ? "duplicate" : "primary"}-${index}`}
                      component="span"
                      aria-hidden={index > 0 ? "true" : undefined}
                      sx={{
                        color: "primary.dark",
                        fontWeight: 900,
                        fontSize: { xs: "0.88rem", md: "0.98rem" }
                      }}
                    >
                      {index > 0 ? " \u00a0 • \u00a0 " : ""}
                      {item}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
