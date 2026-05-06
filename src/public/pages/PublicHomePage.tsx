import { ReactNode, useMemo } from "react";
import { Box, Button, Card, CardContent, Chip, Container, LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import dayjs from "dayjs";
import EmptyState from "../../shared/components/EmptyState";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { CalendarEvent, ContentItem } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";
import PublicContentCard from "../components/PublicContentCard";
import PublicHomeCarousel from "../components/PublicHomeCarousel";
import PublicSiteShell from "../components/PublicSiteShell";
import { ContactMapCard } from "../components/home/ContactMapCard";
import { DirectorHeroCard } from "../components/home/DirectorHeroCard";
import { DocumentListCard } from "../components/home/DocumentListCard";
import { EventListCard } from "../components/home/EventListCard";
import { HomeSectionHeading } from "../components/home/HomeSectionHeading";
import { LatestAnnouncementsCard } from "../components/home/LatestAnnouncementsCard";
import { focusVisibleSx } from "../components/home/homeSectionStyles";
import { UrgentMarqueeSection } from "../components/home/UrgentMarqueeSection";
import { VisitorStatsCard } from "../components/home/VisitorStatsCard";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

interface MockAchievementItem {
  title: string;
  category: string;
  description: string;
  year: string;
  icon: ReactNode;
}

interface MockProcurementItem {
  title: string;
  type: string;
  status: string;
  date: string;
  description: string;
  budget: string;
  href: string;
}

interface MockExternalServiceItem {
  title: string;
  description: string;
  href: string;
  tone: "student" | "homeroom" | "management" | "learning" | "calendar" | "check" | "admission" | "career";
  icon: ReactNode;
}

const documentKeywords = ["เอกสาร", "document", "ita", "แผนงาน", "ประกันคุณภาพ"];

const mockExternalServiceItems: MockExternalServiceItem[] = [
  {
    title: "ระบบ Smart Affair",
    description: "ระบบบริหารจัดการกิจการนักเรียนนักศึกษา",
    href: "https://example.com/smart-affair",
    tone: "student",
    icon: <SchoolOutlinedIcon />
  },
  {
    title: "ระบบ Homeroom",
    description: "ระบบดูแลช่วยเหลือและติดตามผู้เรียน",
    href: "https://example.com/homeroom",
    tone: "homeroom",
    icon: <GroupsOutlinedIcon />
  },
  {
    title: "ระบบ RMS",
    description: "ระบบบริหารจัดการข้อมูลสถานศึกษา",
    href: "https://example.com/rms",
    tone: "management",
    icon: <AppsOutlinedIcon />
  },
  {
    title: "ระบบ LMS",
    description: "ระบบจัดการเรียนรู้ออนไลน์",
    href: "https://example.com/lms",
    tone: "learning",
    icon: <MenuBookOutlinedIcon />
  },
  {
    title: "ระบบ ศธ.02 ออนไลน์",
    description: "บริการข้อมูลทะเบียนและงานวัดผล",
    href: "https://example.com/std2018",
    tone: "calendar",
    icon: <CalendarMonthOutlinedIcon />
  },
  {
    title: "ตรวจสอบผลการเรียน",
    description: "ตรวจสอบข้อมูลผลการเรียนและสถานะผู้เรียน",
    href: "https://example.com/grade-check",
    tone: "check",
    icon: <FactCheckOutlinedIcon />
  },
  {
    title: "ระบบสมัครเรียนออนไลน์",
    description: "สมัครเรียนและติดตามข้อมูลการรับสมัคร",
    href: "https://example.com/admission",
    tone: "admission",
    icon: <HowToRegOutlinedIcon />
  },
  {
    title: "ศูนย์กำลังคนอาชีวศึกษา",
    description: "เชื่อมโยงข้อมูลอาชีพ ฝึกงาน และสถานประกอบการ",
    href: "https://example.com/v-cop",
    tone: "career",
    icon: <HandshakeOutlinedIcon />
  }
];

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

function getPublishDateValue(item: ContentItem) {
  const date = dayjs(item.publishAt);
  return date.isValid() ? date.valueOf() : 0;
}

function sortByPublishDate(items: ContentItem[]) {
  return [...items].sort((left, right) => getPublishDateValue(right) - getPublishDateValue(left));
}

function getEventDateValue(event: CalendarEvent) {
  const date = dayjs(event.date);
  return date.isValid() ? date.valueOf() : Number.POSITIVE_INFINITY;
}

function sortEventsByUpcomingDate(events: CalendarEvent[]) {
  const today = dayjs().startOf("day").valueOf();

  return [...events].sort((left, right) => {
    const leftDate = getEventDateValue(left);
    const rightDate = getEventDateValue(right);
    const leftUpcoming = leftDate >= today;
    const rightUpcoming = rightDate >= today;

    if (leftUpcoming !== rightUpcoming) {
      return leftUpcoming ? -1 : 1;
    }

    return leftUpcoming ? leftDate - rightDate : rightDate - leftDate;
  });
}

function hasContentKeyword(item: ContentItem, keywords: string[]) {
  const haystack = [item.category, ...(item.tags ?? [])].join(" ").toLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function ProcurementNewsSection() {
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

function AchievementHighlightsSection() {
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

function getExternalServiceToneColor(tone: MockExternalServiceItem["tone"]) {
  const colors: Record<MockExternalServiceItem["tone"], string> = {
    student: "#6d28d9",
    homeroom: "#7c3aed",
    management: "#4c1d95",
    learning: "#5b21b6",
    calendar: "#9333ea",
    check: "#6b21a8",
    admission: "#8b5cf6",
    career: "#581c87"
  };

  return colors[tone];
}

function ExternalServicesSection() {
  return (
    <Box component="section" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <HomeSectionHeading
        label="E-Service"
        title="บริการออนไลน์และลิงก์ที่เกี่ยวข้อง"
        description="รวมระบบบริการออนไลน์และลิงก์สำคัญสำหรับนักเรียนนักศึกษา ผู้ปกครอง บุคลากร และผู้สนใจ"
      />

      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 2,
          minHeight: { xs: 160, md: 220 },
          mb: 2.5,
          p: { xs: 2.4, sm: 3, md: 4 },
          display: "flex",
          alignItems: "center",
          background: "linear-gradient(135deg, #3b0764 0%, #6d28d9 48%, #a855f7 100%)",
          color: "white",
          boxShadow: "0 18px 34px rgba(88, 28, 135, 0.2)"
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            right: { xs: -44, md: 44 },
            top: { xs: -36, md: 28 },
            width: { xs: 150, md: 190 },
            height: { xs: 150, md: 190 },
            borderRadius: "50%",
            border: "26px solid rgba(250, 204, 21, 0.18)"
          }}
        />
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            right: { xs: 26, md: 228 },
            bottom: { xs: -28, md: 24 },
            width: 96,
            height: 96,
            borderRadius: 3,
            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.72) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
            opacity: 0.42
          }}
        />
        <Stack spacing={0.9} sx={{ position: "relative", zIndex: 1, maxWidth: 620 }}>
          <Typography
            component="p"
            sx={{
              color: "#fde047",
              fontWeight: 900,
              letterSpacing: 0,
              textTransform: "uppercase"
            }}
          >
            Online Service Portal
          </Typography>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "2.55rem", sm: "3.35rem", md: "4.5rem" },
              lineHeight: 0.95,
              color: "#fef08a"
            }}
          >
            E-Service
          </Typography>
          <Typography sx={{ color: "rgba(255, 255, 255, 0.9)", fontSize: { xs: "1rem", md: "1.18rem" } }}>
            ระบบบริการออนไลน์
          </Typography>
        </Stack>
      </Box>

      <Grid container spacing={2}>
        {mockExternalServiceItems.map((item) => {
          const toneColor = getExternalServiceToneColor(item.tone);

          return (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.title}>
              <Card
                component="a"
                href={normalizeSafeHref(item.href)}
                target="_blank"
                rel="noreferrer"
                aria-label={`เปิดลิงก์บริการ ${item.title}`}
                sx={{
                  height: "100%",
                  display: "block",
                  textDecoration: "none",
                  border: "1px solid rgba(88, 28, 135, 0.16)",
                  bgcolor: "#faf5ff",
                  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                  ...focusVisibleSx,
                  "&:hover": {
                    transform: "translateY(-3px)",
                    borderColor: "rgba(109, 40, 217, 0.35)",
                    boxShadow: "0 16px 30px rgba(88, 28, 135, 0.15)"
                  }
                }}
              >
                <CardContent sx={{ height: "100%", p: 1.8 }}>
                  <Stack spacing={1.35} sx={{ height: "100%" }}>
                    <Stack direction="row" spacing={1.1} alignItems="flex-start" justifyContent="space-between">
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          display: "grid",
                          placeItems: "center",
                          color: "white",
                          bgcolor: toneColor,
                          boxShadow: "0 10px 20px rgba(88, 28, 135, 0.18)",
                          "& svg": {
                            fontSize: 27
                          }
                        }}
                      >
                        {item.icon}
                      </Box>
                      <OpenInNewOutlinedIcon sx={{ color: "text.secondary", fontSize: 19 }} />
                    </Stack>
                    <Stack spacing={0.75} sx={{ flex: 1 }}>
                      <Typography variant="h3" sx={{ fontSize: "1rem", lineHeight: 1.32 }}>
                        {item.title}
                      </Typography>
                      <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.55 }}>
                        {item.description}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

export default function PublicHomePage() {
  const { data, isFetching } = usePublicCmsSnapshot();
  const publicContent = useMemo(
    () => sortByPublishDate((data?.content ?? []).filter((item) => item.status === "published")),
    [data]
  );
  const announcementContent = publicContent.filter((item) => item.type === "announcement");
  const latestNews = publicContent.filter((item) => item.type === "news" || item.type === "blog").slice(0, 4);
  const latestAnnouncements = announcementContent.slice(0, 5);
  const programItems = publicContent.filter((item) => item.type === "program").slice(0, 6);
  const documentItems = publicContent
    .filter((item) => item.type === "page" && hasContentKeyword(item, documentKeywords))
    .slice(0, 6);
  const eventItems = sortEventsByUpcomingDate(
    (data?.events ?? []).filter((event) => event.status === "confirmed" && (event.visibility ?? "public") === "public")
  ).slice(0, 4);

  if (!data) {
    return (
      <PublicSiteShell hidePageHeader disableMainContainer canonicalPath="/">
        {null}
      </PublicSiteShell>
    );
  }

  const siteSettings = normalizeSiteSettings(data.siteSettings);
  const heroImageLayer = siteSettings.heroImageUrl ? `, url(${JSON.stringify(siteSettings.heroImageUrl)})` : "";

  return (
    <PublicSiteShell
      hidePageHeader
      disableMainContainer
      seoDescription={siteSettings.heroDescription || siteSettings.intro}
      canonicalPath="/"
    >
      {isFetching && <LinearProgress />}
      <UrgentMarqueeSection />
      <PublicHomeCarousel />
      <Container maxWidth="xl">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(0, 1fr) minmax(300px, 360px)"
            },
            gap: { xs: 2, md: 3 },
            alignItems: "stretch"
          }}
        >
          <Box
            component="section"
            sx={(theme) => ({
              position: "relative",
              overflow: "hidden",
              borderRadius: 1,
              height: "100%",
              minHeight: { xs: 240, sm: 240, md: 240, lg: 240 },
              display: "flex",
              alignItems: "center",
              p: { xs: 2, sm: 2.5, md: 3.5 },
              color: "white",
              backgroundImage: `linear-gradient(120deg, ${alpha(theme.palette.primary.dark, 0.94)} 0%, ${alpha(
                theme.palette.primary.main,
                0.84
              )} 56%, ${alpha(theme.palette.secondary.dark, 0.58)} 100%)${heroImageLayer}`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              boxShadow: "0 18px 34px rgba(31, 90, 44, 0.16)"
            })}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(12, 34, 14, 0.04) 0%, rgba(12, 34, 14, 0.42) 100%)"
              }}
            />

            <Box
              aria-hidden="true"
              sx={{
                display: { xs: "none", md: "block" },
                position: "absolute",
                right: 44,
                top: 34,
                width: 210,
                height: 210,
                borderRadius: "50%",
                bgcolor: "rgba(255, 255, 255, 0.055)",
                border: "1px solid rgba(255, 255, 255, 0.12)"
              }}
            />

            <Box
              aria-hidden="true"
              sx={{
                display: { xs: "none", lg: "block" },
                position: "absolute",
                right: 108,
                bottom: -36,
                width: 150,
                height: 150,
                borderRadius: "50%",
                bgcolor: "rgba(255, 255, 255, 0.045)"
              }}
            />

            <Stack spacing={{ xs: 1.35, md: 1.6 }} sx={{ position: "relative", zIndex: 1, maxWidth: 620 }}>
              {siteSettings.heroChip && (
                <Chip
                  icon={<SchoolOutlinedIcon />}
                  label={siteSettings.heroChip}
                  sx={{
                    alignSelf: "flex-start",
                    bgcolor: "rgba(255, 255, 255, 0.14)",
                    color: "white",
                    border: "1px solid rgba(255, 255, 255, 0.22)"
                  }}
                />
              )}

              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: "1.75rem", sm: "2.1rem", md: "2.55rem", lg: "2.55rem" },
                  lineHeight: 1.08,
                  letterSpacing: "-0.02em"
                }}
              >
                {siteSettings.heroTitle}
              </Typography>

              {siteSettings.heroDescription && (
                <Typography
                  sx={{
                    maxWidth: 520,
                    color: "rgba(255, 255, 255, 0.84)",
                    fontSize: { xs: "0.92rem", md: "1rem" },
                    lineHeight: 1.55
                  }}
                >
                  {siteSettings.heroDescription}
                </Typography>
              )}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ xs: "stretch", sm: "center" }}>
                {siteSettings.admissionUrl && (
                  <Button
                    variant="contained"
                    color="error"
                    size="medium"
                    href={normalizeSafeHref(siteSettings.admissionUrl)}
                    startIcon={<AssignmentIcon />}
                  >
                    สมัครเรียน
                  </Button>
                )}

                <Button
                  variant="outlined"
                  size="medium"
                  href={normalizeSafeHref("/announcements")}
                  sx={{
                    color: "white",
                    borderColor: "rgba(255, 255, 255, 0.34)"
                  }}
                >
                  ประกาศ
                </Button>

                <Button
                  variant="text"
                  size="medium"
                  href={normalizeSafeHref("/news")}
                  endIcon={<ArrowForwardOutlinedIcon />}
                  sx={{ color: "white" }}
                >
                  ข่าวสาร
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ width: "100%", height: "100%", display: "flex" }}>
            <DirectorHeroCard siteSettings={siteSettings} />
          </Box>
        </Box>

        <Box component="section" id="news" sx={{ mt: { xs: 3, md: 4 } }}>
          <Grid container spacing={3.2} alignItems="flex-start">
            <Grid size={{ xs: 12, lg: 8 }} sx={{ order: { xs: 1, lg: 1 } }}>
              <HomeSectionHeading
                label="ข่าวสาร"
                title="ข่าวสารและกิจกรรมล่าสุด"
                action={
                  <Button href={normalizeSafeHref("/news")} endIcon={<ArrowForwardOutlinedIcon />}>
                    ข่าวทั้งหมด
                  </Button>
                }
              />
              {latestNews.length ? (
                <Grid container spacing={2.5}>
                  {latestNews.map((item) => (
                    <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                      <PublicContentCard
                        item={item}
                        mediaAssets={data?.media ?? []}
                        icon={<CampaignOutlinedIcon sx={{ fontSize: 42 }} />}
                      />
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <EmptyState title="ยังไม่มีข่าวที่เผยแพร่" icon={<ArticleOutlinedIcon />} />
              )}

              <ProcurementNewsSection />

              <Box component="section" id="departments" sx={{ mt: { xs: 4, md: 5.5 } }}>
                <HomeSectionHeading label="หลักสูตร" title="หลักสูตรที่เปิดสอน" />
                {programItems.length ? (
                  <Grid container spacing={2.5}>
                    {programItems.map((item) => (
                      <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                        <PublicContentCard
                          item={item}
                          mediaAssets={data?.media ?? []}
                          icon={<SchoolOutlinedIcon sx={{ fontSize: 42 }} />}
                        />
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <EmptyState title="ยังไม่มีข้อมูลหลักสูตรที่เผยแพร่" icon={<SchoolOutlinedIcon />} />
                )}
              </Box>
              <AchievementHighlightsSection />
              <Box sx={{ display: { xs: "none", lg: "block" } }}>
                <ExternalServicesSection />
              </Box>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }} sx={{ order: { xs: 2, lg: 2 } }}>
              <Stack spacing={2.5}>
                <LatestAnnouncementsCard items={latestAnnouncements} />
                <EventListCard items={eventItems} />
                <DocumentListCard items={documentItems} />
                <Box sx={{ display: { xs: "block", lg: "none" } }}>
                  <ExternalServicesSection />
                </Box>
                <ContactMapCard siteSettings={siteSettings} />
                <VisitorStatsCard />
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </PublicSiteShell>
  );
}
