import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIosNewOutlinedIcon from "@mui/icons-material/ArrowBackIosNewOutlined";
import ArrowForwardIosOutlinedIcon from "@mui/icons-material/ArrowForwardIosOutlined";
import type { SiteSettings } from "../../../features/cms-settings/types";
import { normalizeLeadershipSettings } from "../../../services/siteSettings";
import { DirectorHeroCard } from "./DirectorHeroCard";
import { getHomepageLeadershipPortraits, getLoopedLeadershipIndex } from "./leadershipRotation";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * This widget is mounted only within the public homepage hero.
 * Changes are atomic: photo, name, title and description come from one slot.
 */
export function HomepageLeadershipRotation({ siteSettings }: { siteSettings: SiteSettings }) {
  const portraits = useMemo(() => getHomepageLeadershipPortraits(siteSettings), [siteSettings]);
  const intervalMs = normalizeLeadershipSettings(siteSettings.leadership).autoplayIntervalSeconds * 1000;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const selectedIndex = getLoopedLeadershipIndex(index, portraits.length);
  const current = portraits[selectedIndex];
  const canRotate = portraits.length > 1;
  const autoplay = canRotate && !hovering && !focusWithin && documentVisible && !reducedMotion;

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
    if (!autoplay || typeof window === "undefined") return;
    const id = window.setInterval(() => {
      setIndex((old) => getLoopedLeadershipIndex(old + 1, portraits.length));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoplay, intervalMs, portraits.length]);

  const move = (offset: number) => {
    if (!canRotate) return;
    const next = getLoopedLeadershipIndex(selectedIndex + offset, portraits.length);
    setIndex(next);
    setAnnouncement(`ผู้บริหาร ${next + 1} จาก ${portraits.length}: ${portraits[next].name}`);
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
      <Box sx={{ minHeight: { xs: 335, md: 350 }, display: "flex", alignItems: "center" }}>
        <DirectorHeroCard
          siteSettings={{
            ...siteSettings,
            directorName: current.name,
            directorTitle: current.title,
            directorDescription: current.description,
            directorImageUrl: current.imageUrl
          }}
        />
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
