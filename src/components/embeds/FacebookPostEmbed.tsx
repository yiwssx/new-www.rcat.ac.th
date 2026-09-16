import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack } from "@mui/material";
import FacebookReelSdkEmbed from "../../shared/media/FacebookReelSdkEmbed";
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
// permalink and been stored as /{page}/posts/{id}.
const confirmedLegacyReels = new Map<string, string>([["1609435494524655:1639846248150246", "1639846248150246"]]);

// Meta currently rejects these source posts in both the Reel SDK and the
// embedded-post plugin. Rendering either transport produces Facebook's
// "broken link" UI, so prefer the locally cached preview instead.
const confirmedUnavailableEmbeds = new Set<string>(["1609435494524655:1639846248150246"]);
const confirmedUnavailablePreviews = new Map<string, string>([
  [
    "1609435494524655:1639846248150246",
    "https://drive.google.com/thumbnail?id=1NFMVP_bpiaxHMt-8nyVZOGTuvlyVKdv-&sz=w1200"
  ]
]);

function facebookPostKey(normalizedPostUrl: string) {
  try {
    const parsed = new URL(normalizedPostUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 3 || segments[1]?.toLowerCase() !== "posts") return "";
    return `${segments[0]}:${segments[2]}`;
  } catch {
    return "";
  }
}

function confirmedLegacyReelUrl(normalizedPostUrl: string) {
  const key = facebookPostKey(normalizedPostUrl);
  if (!key) return "";

  const reelId = confirmedLegacyReels.get(key);
  return reelId ? `https://www.facebook.com/reel/${reelId}/` : "";
}

function isConfirmedUnavailableEmbed(normalizedPostUrl: string) {
  const key = facebookPostKey(normalizedPostUrl);
  return Boolean(key && confirmedUnavailableEmbeds.has(key));
}

function confirmedUnavailablePreview(normalizedPostUrl: string) {
  const key = facebookPostKey(normalizedPostUrl);
  return key ? confirmedUnavailablePreviews.get(key) || "" : "";
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

export default function FacebookPostEmbed({
  postUrl,
  title,
  maxWidth = defaultEmbedMaxWidth,
  previewImageUrl
}: FacebookPostEmbedProps) {
  const normalizedPostUrl = normalizeFacebookPostUrl(postUrl);
  const directResolution = normalizedPostUrl ? fallbackResolution(normalizedPostUrl) : null;
  const confirmedUnavailable = Boolean(normalizedPostUrl && isConfirmedUnavailableEmbed(normalizedPostUrl));
  const requiresResolution = Boolean(
    normalizedPostUrl && !confirmedUnavailable && !isFacebookReelUrl(normalizedPostUrl)
  );
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
  const useReelSdk = Boolean(isReel && normalizedPostUrl && isFacebookReelUrl(normalizedPostUrl));
  const pluginEmbedUrl = isReel && !useReelSdk ? normalizedPostUrl : resolvedUrl;
  const safeSourceHref = normalizeSafeHref(normalizedPostUrl || postUrl);
  const cachedPreviewImageUrl = normalizedPostUrl ? confirmedUnavailablePreview(normalizedPostUrl) : "";
  const safePreviewImageUrl = normalizeSafeHref(previewImageUrl || cachedPreviewImageUrl);
  const canOpenSource = Boolean(postUrl.trim()) && safeSourceHref !== "#";
  const canShowPreview = safePreviewImageUrl !== "#";
  const embedTitle = title || "Facebook post";
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

  if (confirmedUnavailable) {
    return (
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <Stack spacing={1.25} sx={{ alignItems: "center", width: "100%", maxWidth: facebookPluginWidth }}>
          {canShowPreview ? (
            <Box
              data-facebook-local-preview="true"
              component="img"
              src={safePreviewImageUrl}
              alt={embedTitle}
              loading="eager"
              sx={{
                display: "block",
                width: "100%",
                maxHeight: 720,
                objectFit: "contain",
                borderRadius: 2,
                bgcolor: "background.default"
              }}
            />
          ) : (
            <Alert severity="info" sx={{ width: "100%" }}>
              Facebook ไม่อนุญาตให้ฝังรายการนี้บนเว็บไซต์ในขณะนี้
            </Alert>
          )}
          {canOpenSource && (
            <Button
              component="a"
              href={safeSourceHref}
              target="_blank"
              rel="noreferrer"
              size="small"
              variant="outlined"
            >
              {sourceLabel}
            </Button>
          )}
        </Stack>
      </Box>
    );
  }

  const embedMaxWidth = Math.min(maxWidth, useReelSdk ? facebookReelMaxWidth : facebookPluginWidth);

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
        {useReelSdk ? (
          <FacebookReelSdkEmbed href={resolvedUrl} preferredWidth={embedMaxWidth} mode="video" showText={false} />
        ) : (
          <ResponsiveFacebookPluginEmbed
            href={pluginEmbedUrl}
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
