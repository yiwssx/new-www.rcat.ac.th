import { Alert, Box, Button, Stack } from "@mui/material";
import FacebookReelSdkEmbed from "../../shared/media/FacebookReelSdkEmbed";
import { isFacebookReelUrl, normalizeFacebookPostUrl } from "../../utils/facebookEmbed";
import { normalizeSafeHref } from "../../utils/safeUrl";

interface FacebookPostEmbedProps {
  postUrl: string;
  title?: string;
  maxWidth?: number;
}

const defaultEmbedMaxWidth = 560;
const facebookSdkMaxWidth = 440;

export default function FacebookPostEmbed({ postUrl, title, maxWidth = defaultEmbedMaxWidth }: FacebookPostEmbedProps) {
  const normalizedPostUrl = normalizeFacebookPostUrl(postUrl);
  const isReel = isFacebookReelUrl(normalizedPostUrl);
  const safeSourceHref = normalizeSafeHref(normalizedPostUrl || postUrl);
  const canOpenSource = Boolean(postUrl.trim()) && safeSourceHref !== "#";
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

  const embedMaxWidth = Math.min(maxWidth, facebookSdkMaxWidth);

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
        <FacebookReelSdkEmbed
          href={normalizedPostUrl}
          preferredWidth={embedMaxWidth}
          mode={isReel ? "video" : "post"}
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
          aria-label={title ? `${sourceLabel}: ${title}` : undefined}
        >
          {sourceLabel}
        </Button>
      </Stack>
    </Box>
  );
}
