import { Box, Paper } from "@mui/material";
import type { HomepageIntroVideoSettings } from "../../../types";
import { HomeSectionHeading } from "./HomeSectionHeading";
import { LazyEmbedFrame } from "./LazyEmbedFrame";

export function HomeIntroVideoSection({ settings }: { settings?: HomepageIntroVideoSettings }) {
  if (!settings?.enabled || !settings.youtubeEmbedUrl.trim()) {
    return null;
  }

  return (
    <Box component="section" id="intro-video" sx={{ mt: { xs: 3, md: 4 } }}>
      <HomeSectionHeading label="แนะนำสถานศึกษา" title={settings.title} />

      <Paper
        elevation={0}
        sx={{
          mt: { xs: 2, md: 2.5 },
          p: { xs: 1, md: 1.25 },
          borderRadius: 2,
          border: "1px solid rgba(31, 90, 44, 0.12)",
          boxShadow: "0 14px 32px rgba(31, 90, 44, 0.1)",
          bgcolor: "background.paper",
          overflow: "hidden"
        }}
      >
        <LazyEmbedFrame
          src={settings.youtubeEmbedUrl}
          title={settings.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: { xs: "16 / 9", md: "21 / 9" },
            minHeight: { xs: 190, sm: 280, md: 420 },
            maxHeight: { md: 560 },
            borderRadius: { xs: 1.5, md: 2 },
            overflow: "hidden",
            bgcolor: "grey.900",
            boxShadow: "0 16px 34px rgba(0, 0, 0, 0.16)"
          }}
        />
      </Paper>
    </Box>
  );
}
