import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import { HomeSectionHeading } from "./HomeSectionHeading";

const mockIntroVideo = {
  title: "วีดิทัศน์แนะนำสถานศึกษา",
  subtitle: "ทำความรู้จักวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด ผ่านบรรยากาศการเรียนรู้ กิจกรรม และการพัฒนาทักษะอาชีพ",
  youtubeEmbedUrl: "https://www.youtube-nocookie.com/embed/crrbCUW4lDo",
  note: "Mock YouTube video สำหรับดูตัวอย่างการแสดงผลก่อนเชื่อมต่อข้อมูลจริง"
};

export function HomeIntroVideoSection() {
  return (
    <Box component="section" id="intro-video" sx={{ mt: { xs: 3, md: 4 } }}>
      <HomeSectionHeading label="แนะนำสถานศึกษา" title="วีดิทัศน์แนะนำสถานศึกษา" />

      <Paper
        elevation={0}
        sx={{
          mt: { xs: 2, md: 2.5 },
          p: { xs: 2, md: 2.5 },
          borderRadius: 2,
          border: "1px solid rgba(31, 90, 44, 0.12)",
          boxShadow: "0 14px 32px rgba(31, 90, 44, 0.1)",
          bgcolor: "background.paper",
          overflow: "hidden"
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 0.9fr) minmax(0, 1.35fr)" },
            gap: { xs: 2, md: 3 },
            alignItems: "center"
          }}
        >
          <Stack spacing={1.6}>
            <Chip
              icon={<OndemandVideoOutlinedIcon />}
              label="YouTube"
              color="primary"
              variant="outlined"
              sx={{ alignSelf: "flex-start", fontWeight: 800 }}
            />

            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PlayCircleOutlineRoundedIcon color="secondary" sx={{ fontSize: 30 }} />
                <Typography variant="h3">{mockIntroVideo.title}</Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>
                {mockIntroVideo.subtitle}
              </Typography>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.86rem" }}>
              {mockIntroVideo.note}
            </Typography>
          </Stack>

          <Box
            sx={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "grey.900",
              boxShadow: "0 16px 34px rgba(0, 0, 0, 0.16)"
            }}
          >
            <Box
              component="iframe"
              src={mockIntroVideo.youtubeEmbedUrl}
              title={mockIntroVideo.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: 0
              }}
            />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
