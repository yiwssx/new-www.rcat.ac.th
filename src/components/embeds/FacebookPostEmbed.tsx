import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack } from "@mui/material";
import ResponsiveFacebookPluginEmbed from "../../shared/media/ResponsiveFacebookPluginEmbed";
import { isFacebookReelUrl, normalizeFacebookPostUrl } from "../../utils/facebookEmbed";
import { normalizeSafeHref } from "../../utils/safeUrl";

interface FacebookPostEmbedProps {
  postUrl: string;
  title?: string;
  maxWidth?: number;
  previewImageUrl?: string;
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
const facebookOembedRevision = "legacy-reel-v2";

// Historical Facebook imports may have lost their original /reel/{id}
// permalink and been stored as /{page}/posts/{id}. Keep the confirmed
// legacy Reel available immediately during SSR/hydration so users never see
// Facebook's broken post-plugin page before the resolver finishes.
const confirmedLegacyReels = new Map<string, string>([["1609435494524655:1639846248150246", "1639846248150246"]]);

function confirmedLegacyReelUrl(normalizedPostUrl: string) {
  try {
    const parsed = new URL(normalizedPostUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 3 || segments[1]?.toLowerCase() !== "posts") return "";

    const reelId = confirmedLegacyReels.get(`${segments[0]}:${segments[2]}`);
    return reelId ? `https://www.facebook.com/reel/${reelId}/` : "";
  } catch {
    return "";
  }
}

function fallbackResolution(normalizedPostUrl: string): FacebookEmbedResolution {
  const legacyReelUrl = confirmedLegacyReelUrl(normalizedPostUrl);
  if (legacyReelUrl) {
    return {
      kind: "reel",
      canonicalUrl: legacyReelUrl
    };
  }

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
  const requiresResolution = Boolean(normalizedPostUrl && !isFacebookReelUrl(normalizedPostUrl));
  const [resolvedPost, setResolvedPost] = useState<ResolvedFacebookPost | null>(null);

  useEffect(() => {
    if (!normalizedPostUrl || !requiresResolution) {
      return;
    }

    const fallback = fallbackResolution(normalizedPostUrl);
    const controller = new AbortController();
    let active = true;
    const resolverUrl = `/api/ssr?_rcatFacebookOembed=1&url=${encodeURIComponent(normalizedPostUrl)}&_rcatFacebookOembedRevision=${facebookOembedRevision}`;

    void fetch(resolverUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
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
        // Keep the direct live embed if classification is temporarily unavailable.
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
  const safeSourceHref = normalizeSafeHref(normalizedPostUrl || postUrl);
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
        <ResponsiveFacebookPluginEmbed
          href={resolvedUrl}
          title={embedTitle}
          preferredWidth={embedMaxWidth}
          height={facebookPostHeight}
          showText
        />
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
