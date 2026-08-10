import { Alert, Box, Button, Stack } from "@mui/material";
import PublicDeferredEmbed from "../../shared/media/PublicDeferredEmbed";
import { buildFacebookPostPluginUrl, isFacebookReelUrl, normalizeFacebookPostUrl } from "../../utils/facebookEmbed";
import { normalizeSafeHref } from "../../utils/safeUrl";

interface FacebookPostEmbedProps {
  postUrl: string;
  title?: string;
  maxWidth?: number;
}

const defaultEmbedMaxWidth = 560;
const facebookPluginWidth = 500;
const facebookPostHeight = 820;
const facebookReelMaxWidth = 440;

export default function FacebookPostEmbed({ postUrl, title, maxWidth = defaultEmbedMaxWidth }: FacebookPostEmbedProps) {
  const normalizedPostUrl = normalizeFacebookPostUrl(postUrl);
  const isReel = isFacebookReelUrl(normalizedPostUrl);
  const pluginWidth = isReel ? Math.min(facebookPluginWidth, facebookReelMaxWidth) : facebookPluginWidth;
  const pluginUrl = normalizedPostUrl
    ? buildFacebookPostPluginUrl({
        href: normalizedPostUrl,
        showText: true,
        width: pluginWidth
      })
    : "";
  const safeSourceHref = normalizeSafeHref(normalizedPostUrl || postUrl);
  const canOpenSource = Boolean(postUrl.trim()) && safeSourceHref !== "#";
  const embedTitle = title || (isReel ? "Facebook Reel" : "Facebook post");
  const sourceLabel = isReel ? "เปิด Reels ต้นทางบน Facebook" : "เปิดโพสต์ต้นทางบน Facebook";
  const fallbackLabel = isReel ? "ดู Reels ต้นทางบน Facebook" : "ดูโพสต์ต้นทางบน Facebook";

  if (!pluginUrl) {
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
          ไม่สามารถแสดงเนื้อหา Facebook แบบฝังได้
        </Alert>
        {canOpenSource && (
          <Button component="a" href={safeSourceHref} target="_blank" rel="noreferrer" variant="outlined">
            {fallbackLabel}
          </Button>
        )}
      </Stack>
    );
  }

  const embedMaxWidth = isReel ? Math.min(maxWidth, facebookReelMaxWidth) : maxWidth;

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
        <PublicDeferredEmbed
          title={embedTitle}
          src={pluginUrl}
          scrolling="no"
          frameBorder="0"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          sx={
            isReel
              ? {
                  width: "100%",
                  aspectRatio: "9 / 16",
                  borderRadius: 1
                }
              : {
                  width: "100%",
                  height: { xs: 760, md: facebookPostHeight },
                  borderRadius: 1
                }
          }
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
