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

const defaultEmbedMaxWidth = 560;
const facebookPluginWidth = 500;
const facebookPostHeight = 820;
const facebookReelMaxWidth = 440;

// These imports are confirmed Reels whose original Facebook permalink was
// persisted as /{page}/posts/{id}. Only explicit identities belong here.
// Every other /posts/ URL must remain a post and must never be promoted to a
// Reel by runtime probing.
const confirmedLegacyReelPosts = new Set<string>(["1609435494524655:1639846248150246"]);

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

function isConfirmedLegacyReel(normalizedPostUrl: string) {
  const key = facebookPostKey(normalizedPostUrl);
  return Boolean(key && confirmedLegacyReelPosts.has(key));
}

export default function FacebookPostEmbed({ postUrl, title, maxWidth = defaultEmbedMaxWidth }: FacebookPostEmbedProps) {
  const normalizedPostUrl = normalizeFacebookPostUrl(postUrl);
  const isReel = Boolean(
    normalizedPostUrl && (isFacebookReelUrl(normalizedPostUrl) || isConfirmedLegacyReel(normalizedPostUrl))
  );
  const safeSourceHref = normalizeSafeHref(normalizedPostUrl || postUrl);
  const canOpenSource = Boolean(postUrl.trim()) && safeSourceHref !== "#";
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
          <FacebookReelSdkEmbed href={normalizedPostUrl} preferredWidth={embedMaxWidth} mode="video" showText={false} />
        ) : (
          <ResponsiveFacebookPluginEmbed
            href={normalizedPostUrl}
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
