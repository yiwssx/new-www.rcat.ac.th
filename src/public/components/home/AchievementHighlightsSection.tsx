import { ReactNode } from "react";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import { HomeSectionHeading } from "./HomeSectionHeading";

interface MockAchievementItem {
  title: string;
  category: string;
  description: string;
  year: string;
  icon: ReactNode;
}

const mockAchievementItems: MockAchievementItem[] = [
  {
    title: "รางวัลทักษะวิชาชีพระดับภาค",
    category: "นักเรียนนักศึกษา",
    description: "ตัวแทนนักศึกษาเข้าร่วมการแข่งขันทักษะวิชาชีพและสร้างชื่อเสียงให้สถานศึกษา",
    year: "2567",
    icon: <WorkspacePremiumOutlinedIcon />
  },
  {
    title: "โครงการเกษตรอัจฉริยะต้นแบบ",
    category: "นวัตกรรม",
    description: "พัฒนาการเรียนรู้ด้านเกษตรสมัยใหม่ด้วยเทคโนโลยีและการลงมือปฏิบัติจริง",
    year: "2567",
    icon: <AutoAwesomeOutlinedIcon />
  },
  {
    title: "ความร่วมมือกับสถานประกอบการ",
    category: "ทวิภาคี",
    description: "ขยายเครือข่ายความร่วมมือเพื่อพัฒนาทักษะอาชีพและประสบการณ์จริงของผู้เรียน",
    year: "2568",
    icon: <GroupsOutlinedIcon />
  },
  {
    title: "ผลงานครูและบุคลากรดีเด่น",
    category: "บุคลากร",
    description: "ส่งเสริมครูและบุคลากรในการพัฒนานวัตกรรมการเรียนรู้และบริการวิชาการ",
    year: "2568",
    icon: <EmojiEventsOutlinedIcon />
  }
];

export function AchievementHighlightsSection() {
  return (
    <Box component="section" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <HomeSectionHeading
        label="ความสำเร็จ"
        title="ผลงานและความภาคภูมิใจ"
        description="รวมผลงานเด่น รางวัล และความภาคภูมิใจของนักเรียนนักศึกษา ครู บุคลากร และสถานศึกษา"
      />
      <Grid container spacing={2.5}>
        {mockAchievementItems.map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={`${item.title}-${item.year}`}>
            <Card
              component="article"
              sx={{
                height: "100%",
                border: "1px solid rgba(31, 90, 44, 0.12)",
                boxShadow: "0 12px 28px rgba(31, 90, 44, 0.08)"
              }}
            >
              <CardContent
                sx={{
                  height: "100%",
                  p: 2.25,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.4
                }}
              >
                <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
                  <Box
                    sx={(theme) => ({
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: "grid",
                      placeItems: "center",
                      color: "primary.dark",
                      bgcolor: alpha(theme.palette.secondary.light, 0.75),
                      border: "1px solid rgba(31, 90, 44, 0.1)",
                      "& svg": {
                        fontSize: 25
                      }
                    })}
                  >
                    {item.icon}
                  </Box>
                  <Chip label={`พ.ศ. ${item.year}`} size="small" color="secondary" sx={{ fontWeight: 800 }} />
                </Stack>

                <Stack spacing={1} sx={{ flex: 1 }}>
                  <Chip label={item.category} size="small" variant="outlined" sx={{ alignSelf: "flex-start" }} />
                  <Typography variant="h3" sx={{ fontSize: { xs: "1.05rem", md: "1.12rem" }, lineHeight: 1.28 }}>
                    {item.title}
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.65 }}>
                    {item.description}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
