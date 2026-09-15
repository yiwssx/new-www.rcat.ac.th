import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack } from "@mui/material";
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

interface ResolvedFacebookPost {
  sourceUrl: string;
  resolution: FacebookEmbedResolution;
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

function resolutionsMatch(left: FacebookEmbedResolution, right: FacebookEmbedResolution) {
  return left.kind === right.kind && left.canonicalUrl === right.canonicalUrl;
}

export default function FacebookPostEmbed({ postUrl, title, maxWidth = defaultEmbedMaxWidth }: FacebookPostEmbedProps) {
  const normalizedPostUrl = normalizeFacebookPostUrl(postUrl);
  const directResolution = normalizedPostUrl ? fallbackResolution(normalizedPostUrl) : null;
  const requiresResolution = Boolean(normalizedPostUrl && directResolution?.kind === "post");
  const [resolvedPost, setResolvedPost] = useState<ResolvedFacebookPost | null>(null);

  useEffect(() => {
    if (!normalizedPostUrl || !requiresResolution) {
      return;
    }

    const fallback = fallbackResolution(normalizedPostUrl);
    const controller = new AbortController();
    let active = true;
    const resolverUrl = `/api/ssr?_rcatFacebookOembed=1&url=${encodeURIComponent(normalizedPostUrl)}`;

    void fetch(resolverUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return parseResolution(await response.json().catch(() => null));
      })
      .then((resolved) => {
        if (!active || !resolved || resolutionsMatch(resolved, fallback)) return;
        setResolvedPost({
          sourceUrl: normalizedPostUrl,
          resolution: resolved
        });
      })
      .catch(() => {
        // The original post iframe remains visible if classification is unavailable.
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [normalizedPostUrl, requiresResolution]);

  const matchingResolvedPost = resolvedPost?.sourceUrl === normalizedPostUrl ? resolvedPost : null;
  const resolution = matchingResolvedPost?.resolution || directResolution;
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
