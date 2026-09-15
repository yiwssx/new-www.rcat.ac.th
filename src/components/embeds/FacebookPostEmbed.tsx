import { Alert, Box, Button, Stack, useMediaQuery } from "@mui/material";
import PublicDeferredEmbed from "../../shared/media/PublicDeferredEmbed";
import FacebookReelSdkEmbed from "../../shared/media/FacebookReelSdkEmbed";
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
const facebookSdkMaxWidth = 440;
const facebookMobileBreakpoint = "(max-width:767.95px)";

export default function FacebookPostEmbed({ postUrl, title, maxWidth = defaultEmbedMaxWidth }: FacebookPostEmbedProps) {
  const normalizedPostUrl = normalizeFacebookPostUrl(postUrl);
  const isReel = isFacebookReelUrl(normalizedPostUrl);
  const isMobileViewport = useMediaQuery(facebookMobileBreakpoint);
  const pluginUrl =
    normalizedPostUrl && !isReel
      ? buildFacebookPostPluginUrl({
          href: normalizedPostUrl,
          showText: true,
          width: facebookPluginWidth
        })
      : "";
  const safeSourceHref = normalizeSafeHref(normalizedPostUrl || postUrl);
  const canOpenSource = Boolean(postUrl.trim()) && safeSourceHref !== "#";
  const embedTitle = title || "Facebook post";
  const sourceLabel = isReel ? "เปิด Reels ต้นทางบน Facebook" : "เปิดโพสต์ต้นทางบน Facebook";
  const fallbackLabel = isReel ? "ดู Reels ต้นทางบน Facebook" : "ดูโพสต์ต้นทางบน Facebook";

  if (!normalizedPostUrl || (!isReel && !pluginUrl)) {
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

  const useSdkEmbed = isReel || isMobileViewport;
  const embedMaxWidth = useSdkEmbed ? Math.min(maxWidth, facebookSdkMaxWidth) : maxWidth;

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
        {useSdkEmbed ? (
          <FacebookReelSdkEmbed
            href={normalizedPostUrl}
            preferredWidth={embedMaxWidth}
            mode={isReel ? "video" : "post"}
            showText
          />
        ) : (
          <PublicDeferredEmbed
            title={embedTitle}
            src={pluginUrl}
            loadMode="near-viewport"
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            sx={{
              width: "100%",
              height: { xs: 760, md: facebookPostHeight },
              borderRadius: 1
            }}
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
