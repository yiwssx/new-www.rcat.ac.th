import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Box, Chip, Container, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { keyframes } from "@emotion/react";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import type { HomepageMarqueeSettings } from "../../../types";
import { designTokens } from "../../../design-system/tokens";
import {
  formatMarqueeSeconds,
  getFallbackMarqueeMotion,
  getMarqueeMotion,
  getMarqueePixelsPerSecond,
  type MarqueeMotion
} from "./urgentMarqueeMotion";

const useEnhancedEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const marqueeScroll = keyframes`
  from {
    transform: translateX(var(--rcat-marquee-start-x));
  }

  to {
    transform: translateX(var(--rcat-marquee-end-x));
  }
`;

function isSameMotion(current: MarqueeMotion, next: MarqueeMotion) {
  return (
    current.startX === next.startX &&
    current.endX === next.endX &&
    current.durationSeconds === next.durationSeconds &&
    current.reducedMotionDurationSeconds === next.reducedMotionDurationSeconds
  );
}

export function UrgentMarqueeSection({ settings }: { settings?: HomepageMarqueeSettings }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const marqueeText = settings?.text.trim() ?? "";
  const pixelsPerSecond = getMarqueePixelsPerSecond(settings?.speedSeconds);
  const [motion, setMotion] = useState(() => getFallbackMarqueeMotion(pixelsPerSecond));

  useEnhancedEffect(() => {
    if (!settings?.enabled || !marqueeText) {
      return undefined;
    }

    let isActive = true;
    const viewportElement = viewportRef.current;
    const trackElement = trackRef.current;

    if (!viewportElement || !trackElement) {
      return undefined;
    }

    const measuredViewportElement: HTMLDivElement = viewportElement;
    const measuredTrackElement: HTMLDivElement = trackElement;

    function measure() {
      if (!isActive) {
        return;
      }

      const viewportWidth = measuredViewportElement.getBoundingClientRect().width;
      const trackWidth = Math.max(measuredTrackElement.scrollWidth, measuredTrackElement.getBoundingClientRect().width);
      const nextMotion = getMarqueeMotion(viewportWidth, trackWidth, pixelsPerSecond);

      setMotion((currentMotion) => (isSameMotion(currentMotion, nextMotion) ? currentMotion : nextMotion));
    }

    measure();

    const resizeObserver =
      typeof window !== "undefined" && typeof window.ResizeObserver !== "undefined"
        ? new window.ResizeObserver(measure)
        : null;

    resizeObserver?.observe(measuredViewportElement);
    resizeObserver?.observe(measuredTrackElement);
    window.addEventListener("resize", measure);

    if (typeof document !== "undefined" && "fonts" in document) {
      void document.fonts.ready.then(() => {
        measure();
      });
    }

    return () => {
      isActive = false;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [marqueeText, pixelsPerSecond, settings?.enabled]);

  if (!settings?.enabled || !marqueeText) {
    return null;
  }

  return (
    <Box component="section" aria-label="ประกาศด่วน" sx={{ py: { xs: 1, md: 1.2 }, bgcolor: "background.default" }}>
      <Container maxWidth="xl">
        <Stack
          direction="row"
          spacing={{ xs: 0.75, sm: 1.4 }}
          sx={[
            {
              alignItems: "center"
            },
            (theme) => ({
              overflow: "hidden",
              borderRadius: `${designTokens.radius.medium}px`,
              border: "1px solid",
              borderColor: "secondary.main",
              bgcolor: alpha(theme.palette.secondary.light, 0.36),
              boxShadow: designTokens.elevation.low,
              px: { xs: 1.2, sm: 1.5, md: 2 },
              py: { xs: 0.85, md: 0.95 },
              "&:hover .rcat-marquee-track": {
                animationPlayState: "paused"
              },
              "@media (prefers-reduced-motion: reduce)": {
                "& .rcat-marquee-track": {
                  // This is an urgent public notice, so reduced motion slows the ticker instead of stopping it.
                  animationDuration: "var(--rcat-marquee-reduced-motion-duration)"
                }
              }
            })
          ]}
        >
          <Chip
            icon={<CampaignOutlinedIcon />}
            label={settings.label}
            color="secondary"
            sx={{
              alignSelf: "center",
              flexShrink: 0,
              color: "secondary.contrastText",
              fontWeight: 900,
              "& .MuiChip-icon": {
                color: "secondary.contrastText"
              }
            }}
          />
          <Box ref={viewportRef} className="rcat-marquee-viewport" sx={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
            <Box
              ref={trackRef}
              className="rcat-marquee-track"
              style={
                {
                  "--rcat-marquee-start-x": motion.startX,
                  "--rcat-marquee-end-x": motion.endX,
                  "--rcat-marquee-duration": `${formatMarqueeSeconds(motion.durationSeconds)}s`,
                  "--rcat-marquee-reduced-motion-duration": `${formatMarqueeSeconds(
                    motion.reducedMotionDurationSeconds
                  )}s`
                } as CSSProperties
              }
              sx={{
                display: "inline-flex",
                width: "max-content",
                whiteSpace: "nowrap",
                animationName: `${marqueeScroll}`,
                animationDuration: "var(--rcat-marquee-duration)",
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDelay: "0s",
                willChange: "transform"
              }}
            >
              <Typography
                component="span"
                data-testid="urgent-marquee-group"
                sx={{
                  color: "primary.dark",
                  fontWeight: 900,
                  fontSize: { xs: "0.88rem", md: "0.98rem" },
                  pr: { xs: 4, md: 6 }
                }}
              >
                {marqueeText}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
