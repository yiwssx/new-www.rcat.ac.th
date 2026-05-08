import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

interface MockJobOpportunityItem {
  title: string;
  type: string;
  status: string;
  date: string;
  organization: string;
  description: string;
  qualification: string;
  href: string;
}

const mockJobOpportunityItems: MockJobOpportunityItem[] = [
  {
    title: "ประกาศรับสมัครครูอัตราจ้าง สาขาวิชาคอมพิวเตอร์ธุรกิจ",
    type: "รับสมัครงาน",
    status: "เปิดรับสมัคร",
    date: "20 พฤษภาคม 2568",
    organization: "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
    description: "รับสมัครบุคลากรเพื่อสนับสนุนการจัดการเรียนการสอนด้านเทคโนโลยีธุรกิจดิจิทัล",
    qualification: "วุฒิปริญญาตรีหรือสูงกว่าในสาขาที่เกี่ยวข้อง",
    href: "/announcements"
  },
  {
    title: "ประชาสัมพันธ์ตำแหน่งงานว่างจากสถานประกอบการเครือข่าย",
    type: "หางาน",
    status: "รับสมัครต่อเนื่อง",
    date: "18 พฤษภาคม 2568",
    organization: "สถานประกอบการคู่ความร่วมมือ",
    description: "รวบรวมตำแหน่งงานว่างสำหรับนักเรียน นักศึกษา และศิษย์เก่าที่สนใจสมัครงาน",
    qualification: "นักเรียน นักศึกษา ศิษย์เก่า หรือผู้สนใจทั่วไป",
    href: "/announcements"
  },
  {
    title: "รับสมัครนักศึกษาฝึกงานด้านเทคโนโลยีสารสนเทศ",
    type: "ฝึกงาน",
    status: "เปิดรับสมัคร",
    date: "12 พฤษภาคม 2568",
    organization: "หน่วยงานภาคีเครือข่าย",
    description: "เปิดรับนักศึกษาฝึกประสบการณ์วิชาชีพด้านระบบสารสนเทศ งานสนับสนุนผู้ใช้ และงานเครือข่าย",
    qualification: "กำลังศึกษาในสาขาคอมพิวเตอร์ เทคโนโลยีธุรกิจดิจิทัล หรือสาขาที่เกี่ยวข้อง",
    href: "/announcements"
  },
  {
    title: "แนะแนวอาชีพและเตรียมความพร้อมก่อนเข้าสู่ตลาดแรงงาน",
    type: "แนะแนวอาชีพ",
    status: "ประชาสัมพันธ์",
    date: "5 พฤษภาคม 2568",
    organization: "งานแนะแนวอาชีพและจัดหางาน",
    description: "กิจกรรมส่งเสริมทักษะการสมัครงาน การเตรียมแฟ้มสะสมผลงาน และการสัมภาษณ์งาน",
    qualification: "สำหรับนักเรียน นักศึกษา และผู้สำเร็จการศึกษา",
    href: "/announcements"
  }
];

export function JobOpportunitiesSection() {
  return (
    <Box component="section" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <HomeSectionHeading
        label="สมัครงาน / หางาน"
        title="ข่าวสมัครงานและโอกาสทางอาชีพ"
        description="ประกาศรับสมัครงาน ข่าวตำแหน่งงานว่าง โอกาสฝึกงาน และข้อมูลแนะแนวอาชีพสำหรับนักเรียน นักศึกษา ศิษย์เก่า และผู้สนใจ"
        action={
          <Button href={normalizeSafeHref("/announcements")} endIcon={<ArrowForwardOutlinedIcon />}>
            ดูทั้งหมด
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        {mockJobOpportunityItems.map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={`${item.type}-${item.title}`}>
            <Card
              component="article"
              sx={{
                height: "100%",
                border: "1px solid rgba(31, 90, 44, 0.12)",
                boxShadow: "0 12px 28px rgba(31, 90, 44, 0.07)"
              }}
            >
              <CardContent
                sx={{
                  height: "100%",
                  p: 2.25,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.35
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip icon={<WorkOutlineRoundedIcon />} label={item.type} size="small" color="primary" />
                  <Chip label={item.status} size="small" color="secondary" variant="outlined" />
                </Stack>

                <Typography variant="h3" sx={{ fontSize: { xs: "1.04rem", md: "1.1rem" }, lineHeight: 1.32 }}>
                  {item.title}
                </Typography>

                <Stack spacing={0.75}>
                  <Typography color="text.secondary" variant="body2" fontWeight={800}>
                    {item.date}
                  </Typography>
                  <Stack direction="row" spacing={0.7} alignItems="center">
                    <BusinessCenterOutlinedIcon sx={{ color: "primary.dark", fontSize: 19 }} />
                    <Typography color="primary.dark" variant="body2" fontWeight={900}>
                      {item.organization}
                    </Typography>
                  </Stack>
                  <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.65 }}>
                    {item.description}
                  </Typography>
                </Stack>

                <Box
                  sx={(theme) => ({
                    mt: "auto",
                    p: 1.15,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.secondary.light, 0.45),
                    border: "1px solid rgba(184, 135, 0, 0.14)"
                  })}
                >
                  <Stack direction="row" spacing={0.8} alignItems="flex-start">
                    <SchoolOutlinedIcon sx={{ color: "secondary.dark", fontSize: 20, mt: 0.1 }} />
                    <Typography color="primary.dark" variant="body2" fontWeight={800}>
                      {item.qualification}
                    </Typography>
                  </Stack>
                </Box>

                <Button
                  href={normalizeSafeHref(item.href)}
                  endIcon={<ArrowForwardOutlinedIcon />}
                  aria-label={`อ่านข่าวสมัครงาน ${item.title}`}
                  sx={{ alignSelf: "flex-start", px: 0 }}
                >
                  อ่านรายละเอียด
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
