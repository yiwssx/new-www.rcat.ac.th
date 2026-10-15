import { keyframes } from "@emotion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIosNewOutlinedIcon from "@mui/icons-material/ArrowBackIosNewOutlined";
import ArrowForwardIosOutlinedIcon from "@mui/icons-material/ArrowForwardIosOutlined";
import type { SiteSettings } from "../../../features/cms-settings/types";
import { normalizeLeadershipSettings } from "../../../services/siteSettings";
import {
  resolvePublicImageFallbackSource,
  resolvePublicImageSource
} from "../../../shared/media/publicImageSources";
import { usePublicMediaLoading } from "../../../shared/media/publicMediaLoadingState";
import { DirectorHeroCard } from "./DirectorHeroCard";
import {
  getHomepageLeadershipPortraits,
  getLoopedLeadershipIndex,
  type LeadershipPortrait
} from "./leadershipRotation";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const TRANSITION_MS = 550;
const IMAGE_PRELOAD_TIMEOUT_MS = 1800;
const TRANSITION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const enterMotion = keyframes({
  from: { opacity: 0, transform: "translateY(6px)" },
  to: { opacity: 1, transform: "translateY(0)" }
});

const leaveMotion = keyframes({
  from: { opacity: 1, transform: "translateY(0)" },
  to: { opacity: 0, transform: "translateY(-6px)" }
});

function settingsForPortrait(settings: SiteSettings, portrait: LeadershipPortrait): SiteSettings {
  return {
    ...settings,
    directorName: portrait.name,
    directorTitle: portrait.title,
    directorDescription: portrait.description,
    directorImageUrl: portrait.imageUrl
  };
}

/**
 * Homepage-only portrait rotation. Outgoing and incoming records retain their
 * own matching image and text during a bounded 550 ms crossfade.
 */
export function HomepageLeadershipRotation({ siteSettings }: { siteSettings: SiteSettings }) {
  const portraits = useMemo(() => getHomepageLeadershipPortraits(siteSettings), [siteSettings]);
  const intervalMs = normalizeLeadershipSettings(siteSettings.leadership).autoplayIntervalSeconds * 1000;
  const { pageMediaAllowed } = usePublicMediaLoading();
  const [index, setIndex] = useState(0);
  const [outgoing, setOutgoing] = useState<LeadershipPortrait | null>(null);
  const [transitionVersion, setTransitionVersion] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const cleanupTimerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const warmedSourcesRef = useRef(new Set<string>());
  const warmingSourcesRef = useRef(new Map<string, Promise<void>>());

  const selectedIndex = getLoopedLeadershipIndex(index, portraits.length);
  const current = portraits[selectedIndex];
  const canRotate = portraits.length > 1;
  const autoplay = canRotate && !hovering && !focusWithin && documentVisible && !reducedMotion;

  const warmPortrait = useCallback(
    (portrait: LeadershipPortrait | undefined): Promise<void> => {
      if (!portrait || !pageMediaAllowed || typeof window === "undefined") {
        return Promise.resolve();
      }

      const source = resolvePublicImageSource(portrait.imageUrl, "portrait").src;
      if (!source || warmedSourcesRef.current.has(source)) {
        return Promise.resolve();
      }

      const existing = warmingSourcesRef.current.get(source);
      if (existing) return existing;

      const fallback = resolvePublicImageFallbackSource(portrait.imageUrl, "portrait").src;
      const promise = new Promise<void>((resolve) => {
        const image = new window.Image();
        let fallbackAttempted = false;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          image.onload = null;
          image.onerror = null;
          warmedSourcesRef.current.add(source);
          resolve();
        };
        const timeoutId = window.setTimeout(finish, IMAGE_PRELOAD_TIMEOUT_MS);
        image.onload = finish;
        image.onerror = () => {
          if (!fallbackAttempted && fallback && fallback !== source) {
            fallbackAttempted = true;
            image.src = fallback;
            return;
          }
          finish();
        };
        image.src = source;
      });

      warmingSourcesRef.current.set(source, promise);
      return promise;
    },
    [pageMediaAllowed]
  );

  const completeTransition = useCallback(() => {
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    setOutgoing(null);
  }, []);

  const commitSelection = useCallback(
    (nextIndex: number, announce: boolean) => {
      const portrait = portraits[nextIndex];
      if (!portrait || nextIndex === selectedIndex) return;

      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }

      setOutgoing(reducedMotion ? null : current);
      setIndex(nextIndex);
      setTransitionVersion((version) => version + 1);

      if (!reducedMotion) {
        cleanupTimerRef.current = window.setTimeout(completeTransition, TRANSITION_MS);
      }

      if (announce) {
        setAnnouncement("ผู้บริหาร " + (nextIndex + 1) + " จาก " + portraits.length + ": " + portrait.name);
      }
    },
    [completeTransition, current, portraits, reducedMotion, selectedIndex]
  );

  const selectPortrait = useCallback(
    (nextIndex: number, announce = false) => {
      const normalized = getLoopedLeadershipIndex(nextIndex, portraits.length);
      const portrait = portraits[normalized];
      if (!portrait || normalized === selectedIndex) return;

      const requestId = ++requestIdRef.current;
      const source = resolvePublicImageSource(portrait.imageUrl, "portrait").src;
      if (!source || !pageMediaAllowed || warmedSourcesRef.current.has(source)) {
        commitSelection(normalized, announce);
        return;
      }

      // Keep the existing portrait visible until the next image has loaded
      // (or a bounded failure/timeout permits its normal visual fallback).
      void warmPortrait(portrait).then(() => {
        if (requestId !== requestIdRef.current) return;
        commitSelection(normalized, announce);
      });
    },
    [commitSelection, pageMediaAllowed, portraits, selectedIndex, warmPortrait]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setDocumentVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener?.("change", update);
    return () => preference.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!reducedMotion) return;
    completeTransition();
  }, [completeTransition, reducedMotion]);

  useEffect(() => {
    if (!canRotate) return;
    void warmPortrait(portraits[getLoopedLeadershipIndex(selectedIndex + 1, portraits.length)]);
  }, [canRotate, portraits, selectedIndex, warmPortrait]);

  useEffect(() => {
    if (!autoplay || typeof window === "undefined") return;
    const id = window.setInterval(() => {
      selectPortrait(selectedIndex + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoplay, intervalMs, selectPortrait, selectedIndex]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
      }
    };
  }, []);

  const move = (offset: number) => {
    if (!canRotate) return;
    selectPortrait(selectedIndex + offset, true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  };

  if (!current) return <DirectorHeroCard siteSettings={siteSettings} />;

  return (
    <Box
      component="section"
      role="region"
      aria-roledescription="carousel"
      aria-label="ผู้บริหารสถานศึกษา"
      tabIndex={canRotate ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      sx={{ width: "100%", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}
    >
      <Box
        data-leadership-stage="true"
        sx={{
          minHeight: { xs: 350, md: 365 },
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          alignItems: "center",
          position: "relative"
        }}
      >
        {outgoing && !reducedMotion && (
          <Box
            key={"outgoing-" + transitionVersion}
            data-leadership-layer="outgoing"
            aria-hidden="true"
            sx={{
              gridArea: "1 / 1",
              pointerEvents: "none",
              animation: [leaveMotion, TRANSITION_MS + "ms", TRANSITION_EASING, "both"].join(" ")
            }}
          >
            <DirectorHeroCard siteSettings={settingsForPortrait(siteSettings, outgoing)} imageLoadMode="eager" />
          </Box>
        )}
        <Box
          key={"incoming-" + current.slot + "-" + transitionVersion}
          data-leadership-layer="current"
          sx={{
            gridArea: "1 / 1",
            minWidth: 0,
            animation:
              outgoing && !reducedMotion
                ? [enterMotion, TRANSITION_MS + "ms", TRANSITION_EASING, "both"].join(" ")
                : undefined
          }}
        >
          <DirectorHeroCard siteSettings={settingsForPortrait(siteSettings, current)} imageLoadMode="eager" />
        </Box>
      </Box>
      {canRotate && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "center", mt: 0.5 }}>
          <IconButton size="small" onClick={() => move(-1)} aria-label="ผู้บริหารก่อนหน้า">
            <ArrowBackIosNewOutlinedIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 56, textAlign: "center" }}>
            {selectedIndex + 1} / {portraits.length}
          </Typography>
          <IconButton size="small" onClick={() => move(1)} aria-label="ผู้บริหารถัดไป">
            <ArrowForwardIosOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}
      <Box
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0
        }}
      >
        {announcement}
      </Box>
    </Box>
  );
}
