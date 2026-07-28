import { Alert, Box, Button, Stack } from "@mui/material";
import PublicDeferredEmbed from "../../shared/media/PublicDeferredEmbed";
import { buildFacebookPostPluginUrl, normalizeFacebookPostUrl } from "../../utils/facebookEmbed";
import { normalizeSafeHref } from "../../utils/safeUrl";

interface FacebookPostEmbedProps {
  postUrl: string;
  title?: string;
  maxWidth?: number;
}

const defaultEmbedMaxWidth = 560;
const facebookPluginWidth = 500;
const facebookPostHeight = 820;

export default function FacebookPostEmbed({
  postUrl,
  title = "Facebook post",
  maxWidth = defaultEmbedMaxWidth
}: FacebookPostEmbedProps) {
  const normalizedPostUrl = normalizeFacebookPostUrl(postUrl);
  const pluginUrl = normalizedPostUrl
    ? buildFacebookPostPluginUrl({
        href: normalizedPostUrl,
        showText: true,
        width: facebookPluginWidth
      })
    : "";
  const safeSourceHref = normalizeSafeHref(normalizedPostUrl || postUrl);
  const canOpenSource = Boolean(postUrl.trim()) && safeSourceHref !== "#";

  if (!pluginUrl) {
    return (
      <Stack spacing={1.5} alignItems="center" sx={{ width: "100%", textAlign: "center" }}>
        <Alert severity="warning" sx={{ width: "100%", maxWidth }}>
          ไม่สามารถแสดงโพสต์ Facebook แบบฝังได้
        </Alert>
        {canOpenSource && (
          <Button component="a" href={safeSourceHref} target="_blank" rel="noreferrer" variant="outlined">
            ดูโพสต์ต้นทางบน Facebook
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <Stack spacing={1} alignItems="center" sx={{ width: "100%", maxWidth }}>
        <PublicDeferredEmbed
          title={title}
          src={pluginUrl}
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
        <Button
          component="a"
          href={safeSourceHref}
          target="_blank"
          rel="noreferrer"
          size="small"
          variant="text"
          sx={{ px: 0 }}
        >
          เปิดโพสต์ต้นทางบน Facebook
        </Button>
      </Stack>
    </Box>
  );
}
