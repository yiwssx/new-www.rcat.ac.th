import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import ResponsiveFacebookPluginEmbed from "../../shared/media/ResponsiveFacebookPluginEmbed";
import FacebookReelSdkEmbed from "../../shared/media/FacebookReelSdkEmbed";
import { isFacebookReelUrl, normalizeFacebookPostUrl } from "../../utils/facebookEmbed";
import { normalizeSafeHref } from "../../utils/safeUrl";

interface FacebookPostEmbedProps {
  postUrl: string;
  title?: string;
  maxWidth?: number;
}

interface FacebookEmbedResolution {
  kind: "post" | "reel";
  canonicalUrl: string;
}

const defaultEmbedMaxWidth = 560;
const facebookPluginWidth = 500;
const facebookPostHeight = 820;
const facebookReelMaxWidth = 440;

function fallbackResolution(normalizedPostUrl: string): FacebookEmbedResolution {
  return {
    kind: isFacebookReelUrl(normalizedPostUrl) ? "reel" : "post",
    canonicalUrl: normalizedPostUrl
  };
}

function parseResolution(payload: unknown): FacebookEmbedResolution | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (record.ok !== true || (record.kind !== "post" && record.kind !== "reel")) return null;

  const canonicalUrl = normalizeFacebookPostUrl(String(record.canonicalUrl ?? ""));
  if (!canonicalUrl) return null;
  if (record.kind === "reel" && !isFacebookReelUrl(canonicalUrl)) return null;
  if (record.kind === "post" && isFacebookReelUrl(canonicalUrl)) return null;

  return {
    kind: record.kind,
    canonicalUrl
  };
}

export default function FacebookPostEmbed({ postUrl, title, maxWidth = defaultEmbedMaxWidth }: FacebookPostEmbedProps) {
  const normalizedPostUrl = normalizeFacebookPostUrl(postUrl);
  const directResolution = normalizedPostUrl ? fallbackResolution(normalizedPostUrl) : null;
  const requiresResolution = Boolean(normalizedPostUrl && directResolution?.kind === "post");
  const [resolution, setResolution] = useState<FacebookEmbedResolution | null>(
    requiresResolution ? null : directResolution
  );
  const [isResolving, setIsResolving] = useState(requiresResolution);

  useEffect(() => {
    if (!normalizedPostUrl) {
      setResolution(null);
      setIsResolving(false);
      return;
    }

    const fallback = fallbackResolution(normalizedPostUrl);
    if (fallback.kind === "reel") {
      setResolution(fallback);
      setIsResolving(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setResolution(null);
    setIsResolving(true);

    void fetch(`/api/facebook-oembed?url=${encodeURIComponent(normalizedPostUrl)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return parseResolution(await response.json().catch(() => null));
      })
      .then((resolved) => {
        if (!active) return;
        setResolution(resolved || fallback);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setResolution(fallback);
      })
      .finally(() => {
        if (active) setIsResolving(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [normalizedPostUrl]);

  const resolvedUrl = resolution?.canonicalUrl || normalizedPostUrl;
  const isReel = resolution?.kind === "reel" || isFacebookReelUrl(resolvedUrl);
  const safeSourceHref = normalizeSafeHref(resolvedUrl || postUrl);
  const canOpenSource = Boolean(postUrl.trim()) && safeSourceHref !== "#";
  const embedTitle = title || (isReel ? "Facebook Reel" : "Facebook post");
  const sourceLabel = isReel ? "เปิด Reels ต้นทางบน Facebook" : "เปิดโพสต์ต้นทางบน Facebook";
  const fallbackLabel = isReel ? "ดู Reels ต้นทางบน Facebook" : "ดูโพสต์ต้นทางบน Facebook";

  if (!normalizedPostUrl) {
    return (
      <Stack
        spacing={1.5}
        sx={{
          alignItems: "center",
          width: "100%",
          textAlign: "center"
        }}
      >
        <Alert severity="warning" sx={{ width: "100%", maxWidth }}>
          ไม่สามารถแสดงโพสต์ Facebook แบบฝังได้
        </Alert>
        {canOpenSource && (
          <Button component="a" href={safeSourceHref} target="_blank" rel="noreferrer" variant="outlined">
            {fallbackLabel}
          </Button>
        )}
      </Stack>
    );
  }

  if (isResolving && !resolution) {
    return (
      <Stack
        spacing={1.25}
        role="status"
        aria-label="กำลังตรวจสอบเนื้อหา Facebook"
        sx={{
          width: "100%",
          minHeight: 180,
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center"
        }}
      >
        <CircularProgress size={30} />
        <Typography variant="body2" color="text.secondary">
          กำลังโหลดเนื้อหาจาก Facebook…
        </Typography>
      </Stack>
    );
  }

  const embedMaxWidth = Math.min(maxWidth, isReel ? facebookReelMaxWidth : facebookPluginWidth);

  return (
    <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <Stack
        spacing={1}
        sx={{
          alignItems: "center",
          width: "100%",
          maxWidth: embedMaxWidth
        }}
      >
        {isReel ? (
          <FacebookReelSdkEmbed href={resolvedUrl} preferredWidth={embedMaxWidth} mode="video" showText={false} />
        ) : (
          <ResponsiveFacebookPluginEmbed
            href={resolvedUrl}
            title={embedTitle}
            preferredWidth={embedMaxWidth}
            height={facebookPostHeight}
            showText
          />
        )}
        <Button
          component="a"
          href={safeSourceHref}
          target="_blank"
          rel="noreferrer"
          size="small"
          variant="text"
          sx={{ px: 0 }}
        >
          {sourceLabel}
        </Button>
      </Stack>
    </Box>
  );
}
