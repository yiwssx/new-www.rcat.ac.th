import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

interface MockProcurementItem {
  title: string;
  type: string;
  status: string;
  date: string;
  description: string;
  budget: string;
  href: string;
}

const mockProcurementItems: MockProcurementItem[] = [
  {
    title: "ประกาศประกวดราคาซื้อครุภัณฑ์คอมพิวเตอร์เพื่อการเรียนการสอน",
    type: "ประกวดราคา",
    status: "เปิดรับข้อเสนอ",
    date: "15 พฤษภาคม 2568",
    description: "จัดซื้อครุภัณฑ์คอมพิวเตอร์และอุปกรณ์สนับสนุนการจัดการเรียนรู้สำหรับห้องปฏิบัติการ",
    budget: "งบประมาณ 499,800 บาท",
    href: "/announcements"
  },
  {
    title: "ประกาศผู้ชนะการเสนอราคาจ้างปรับปรุงระบบเครือข่ายภายในอาคารเรียน",
    type: "ประกาศผู้ชนะ",
    status: "ประกาศผลแล้ว",
    date: "8 พฤษภาคม 2568",
    description: "งานปรับปรุงระบบเครือข่ายและจุดกระจายสัญญาณอินเทอร์เน็ตเพื่อรองรับการเรียนการสอน",
    budget: "งบประมาณ 180,000 บาท",
    href: "/announcements"
  },
  {
    title: "ร่างขอบเขตของงานจัดซื้อวัสดุฝึกปฏิบัติการเกษตร",
    type: "ร่าง TOR",
    status: "รับฟังความคิดเห็น",
    date: "2 พฤษภาคม 2568",
    description: "เผยแพร่ร่างขอบเขตของงานสำหรับวัสดุฝึกปฏิบัติด้านพืชศาสตร์และสัตวศาสตร์",
    budget: "งบประมาณ 95,000 บาท",
    href: "/announcements"
  },
  {
    title: "ประกาศแผนการจัดซื้อจัดจ้างประจำปีงบประมาณ",
    type: "แผนจัดซื้อจัดจ้าง",
    status: "เผยแพร่แล้ว",
    date: "25 เมษายน 2568",
    description: "เผยแพร่แผนการจัดซื้อจัดจ้างเพื่อความโปร่งใสและเปิดเผยข้อมูลต่อสาธารณะ",
    budget: "ตามแผนงบประมาณ",
    href: "/announcements"
  }
];

export function ProcurementNewsSection() {
  return (
    <Box component="section" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <HomeSectionHeading
        label="จัดซื้อจัดจ้าง"
        title="ข่าวจัดซื้อจัดจ้าง"
        description="ประกาศ แผนจัดซื้อจัดจ้าง ร่างขอบเขตของงาน และผลการพิจารณาที่เกี่ยวข้องกับการจัดซื้อจัดจ้างของสถานศึกษา"
        action={
          <Button href={normalizeSafeHref("/announcements")} endIcon={<ArrowForwardOutlinedIcon />}>
            ดูทั้งหมด
          </Button>
        }
      />
      <Grid container spacing={2.5}>
        {mockProcurementItems.map((item) => (
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
                  <Chip icon={<RequestQuoteOutlinedIcon />} label={item.type} size="small" color="primary" />
                  <Chip label={item.status} size="small" color="secondary" variant="outlined" />
                </Stack>

                <Stack spacing={0.9} sx={{ flex: 1 }}>
                  <Typography variant="h3" sx={{ fontSize: { xs: "1.04rem", md: "1.1rem" }, lineHeight: 1.32 }}>
                    {item.title}
                  </Typography>
                  <Typography color="text.secondary" variant="body2" fontWeight={800}>
                    {item.date}
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.65 }}>
                    {item.description}
                  </Typography>
                  <Box
                    sx={(theme) => ({
                      mt: "auto",
                      p: 1.15,
                      borderRadius: 1.5,
                      bgcolor: alpha(theme.palette.primary.light, 0.62),
                      border: "1px solid rgba(31, 90, 44, 0.1)"
                    })}
                  >
                    <Typography color="primary.dark" variant="body2" fontWeight={900}>
                      {item.budget}
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  href={normalizeSafeHref(item.href)}
                  endIcon={<ArrowForwardOutlinedIcon />}
                  aria-label={`อ่านประกาศจัดซื้อจัดจ้าง ${item.title}`}
                  sx={{ alignSelf: "flex-start", px: 0 }}
                >
                  อ่านประกาศ
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
