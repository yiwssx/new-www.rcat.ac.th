import { ReactNode, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import FacebookRoundedIcon from "@mui/icons-material/FacebookRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import YouTubeIcon from "@mui/icons-material/YouTube";
import dayjs from "dayjs";
import PublicMainMenu from "../components/PublicMainMenu";
import { getCmsSiteName, projectSettings } from "../config/projectSettings";
import { useLanguage } from "../context/LanguageContext";
import { loadPublicLanguageSource } from "../services/languageSource";
import { getCmsSnapshot } from "../services/googleApi";
import { formatDisplayDate, formatDisplayDateTime } from "../utils/dateDisplay";

interface SectionHeadingProps {
  label: string;
  title: string;
  description: string;
}

interface NavItem {
  label: string;
  href: string;
}

interface QuickLink {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}

interface PrideHighlight {
  value: string;
  title: string;
  description: string;
  icon: ReactNode;
}

interface DocumentLink {
  title: string;
  category: string;
}

interface SocialLink {
  label: string;
  href: string;
  icon: ReactNode;
}

const programs = [
  {
    title: "Engineering Technology",
    description: "Automation, robotics, electronics, and applied engineering projects.",
    icon: <EngineeringOutlinedIcon />
  },
  {
    title: "Digital Business",
    description: "Marketing, entrepreneurship, analytics, and practical business systems.",
    icon: <AutoStoriesOutlinedIcon />
  },
  {
    title: "Student Development",
    description: "Activities, portfolio support, guidance, and career preparation.",
    icon: <GroupsOutlinedIcon />
  }
];

const primaryNavItems: NavItem[] = [
  {
    label: "Home",
    href: "/"
  },
  {
    label: "Overview",
    href: "/#overview"
  },
  {
    label: "Departments",
    href: "/departments"
  },
  {
    label: "News",
    href: "/news"
  },
  {
    label: "Announcements",
    href: "/announcements"
  },
  {
    label: "Contact",
    href: "/contact"
  }
];

const quickLinks: QuickLink[] = [
  {
    title: "Admissions",
    description: "Application windows, qualifications, and required documents.",
    href: "/announcements",
    icon: <SchoolOutlinedIcon />
  },
  {
    title: "Programs",
    description: "Technical, business, and student development pathways.",
    href: "/departments",
    icon: <AutoStoriesOutlinedIcon />
  },
  {
    title: "Academic Calendar",
    description: "Upcoming terms, campus dates, and special academic periods.",
    href: "#calendar",
    icon: <EventAvailableOutlinedIcon />
  },
  {
    title: "Official Documents",
    description: "Reports, quality documents, public notices, and ITA links.",
    href: "/announcements",
    icon: <DescriptionOutlinedIcon />
  }
];

const prideHighlights: PrideHighlight[] = [
  {
    value: "18",
    title: "Innovation showcases",
    description: "Student teams present applied engineering and technology projects each year.",
    icon: <WorkspacePremiumOutlinedIcon />
  },
  {
    value: "12",
    title: "Industry collaborations",
    description: "Academic and workplace learning partnerships support practical pathways.",
    icon: <EngineeringOutlinedIcon />
  },
  {
    value: "24/7",
    title: "Student support services",
    description: "Guidance, academic advising, and portfolio preparation are available year round.",
    icon: <GroupsOutlinedIcon />
  }
];

const documentLinks: DocumentLink[] = [
  {
    title: "Academic Calendar 2026",
    category: "Calendar"
  },
  {
    title: "Annual Action Plan",
    category: "Planning"
  },
  {
    title: "Self Assessment Report",
    category: "Quality"
  },
  {
    title: "ITA and Transparency Portal",
    category: "Public"
  }
];

const socialLinks: SocialLink[] = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/",
    icon: <FacebookRoundedIcon fontSize="small" />
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/",
    icon: <YouTubeIcon fontSize="small" />
  },
  {
    label: "Portal",
    href: "/admin",
    icon: <OpenInNewRoundedIcon fontSize="small" />
  }
];

export const defaultPublicLanguageSource = {
  th: {
    campus: "ศูนย์ข้อมูลวิทยาลัย RCAT",
    portal: "ประชาสัมพันธ์",
    eyebrow: "Royal College of Applied Technology",
    siteName: "เว็บไซต์การศึกษา RCAT",
    intro:
      "ข้อมูลประชาสัมพันธ์ การรับสมัคร หลักสูตร กิจกรรม ประกาศ และการสื่อสารของวิทยาลัยจากระบบ RCAT CMS",
    admissionChip: "เปิดรับสมัคร 2569",
    announcementsButton: "ดูประกาศ",
    staffLogin: "เข้าสู่ระบบเจ้าหน้าที่",
    nav: ["หน้าแรก", "ภาพรวม", "แผนกวิชา", "ข่าว", "ประกาศ", "ติดต่อ"],
    heroChip: "รับสมัคร บริการนักศึกษา และข่าววิทยาลัย",
    heroTitle: "ข้อมูลวิทยาลัยในรูปแบบเว็บไซต์สถานศึกษา",
    heroDescription:
      "ติดตามการรับสมัคร แผนกวิชา ประกาศ เอกสารราชการ และกิจกรรมของวิทยาลัยในหน้าเดียว",
    latestActivities: "กิจกรรมล่าสุด",
    publicDocuments: "เอกสารเผยแพร่",
    featuredNotice: "ข่าวเด่น",
    academicCalendar: "ปฏิทินวิชาการ",
    calendarDescription: "วันสำคัญและกิจกรรมใกล้ถึงของวิทยาลัย",
    overviewLabel: "ภาพรวมวิทยาลัย",
    overviewTitle: "หน้าหลักสำหรับข่าว สารสนเทศ และบริการนักศึกษา",
    overviewDescription:
      "โครงสร้างหน้าเว็บออกแบบให้เหมาะกับสถานศึกษา อ่านง่าย และเชื่อมต่อข้อมูลจาก CMS",
    directorTitle: "สำนักงานผู้อำนวยการวิทยาลัย",
    directorDescription:
      "พื้นที่นำเสนอสารจากผู้บริหาร ข่าวประชาสัมพันธ์ และทิศทางการพัฒนาสถาบัน",
    departmentsLabel: "แผนกวิชา",
    departmentsTitle: "สาขาการเรียนรู้และเส้นทางพัฒนาผู้เรียน",
    departmentsDescription:
      "นำเสนอหลักสูตรและบริการของวิทยาลัยในรูปแบบชัดเจนสำหรับผู้เรียนและผู้ปกครอง",
    prideLabel: "จุดเด่นวิทยาลัย",
    prideTitle: "ผลงาน ความร่วมมือ และบริการสำคัญ",
    prideDescription: "สรุปความโดดเด่นของวิทยาลัยในรูปแบบข้อมูลประชาสัมพันธ์",
    newsLabel: "ข่าวและกิจกรรม",
    newsTitle: "ข่าวล่าสุด กิจกรรม และเรื่องเด่น",
    newsDescription: "พื้นที่ข่าวสารของวิทยาลัยพร้อมเรื่องเด่นและรายการอัปเดตแบบกระชับ",
    posted: "เผยแพร่",
    announcements: "ประกาศ",
    documents: "เอกสารราชการ",
    services: "บริการนักศึกษา",
    contact: "ติดต่อและติดตาม",
    contactAddress: "สำนักงานประชาสัมพันธ์และศูนย์รับสมัคร วิทยาลัย RCAT",
    telephone: "โทรศัพท์",
    email: "อีเมล",
    footerTitle: "RCAT Public Website",
    footerDescription:
      "เว็บไซต์ประชาสัมพันธ์สำหรับการรับสมัคร กิจกรรม เอกสารราชการ และบริการวิชาการของวิทยาลัย",
    backToTop: "กลับด้านบน",
    languageToast: "เปลี่ยนภาษาเป็น TH แล้ว",
    programs: [
      ["เทคโนโลยีวิศวกรรม", "ระบบอัตโนมัติ หุ่นยนต์ อิเล็กทรอนิกส์ และโครงงานประยุกต์"],
      ["ธุรกิจดิจิทัล", "การตลาด ผู้ประกอบการ การวิเคราะห์ข้อมูล และระบบธุรกิจ"],
      ["พัฒนาผู้เรียน", "กิจกรรม แฟ้มสะสมงาน แนะแนว และการเตรียมอาชีพ"]
    ],
    quickLinks: [
      ["รับสมัคร", "ช่วงสมัคร คุณสมบัติ และเอกสารที่ต้องใช้"],
      ["หลักสูตร", "เส้นทางเทคนิค ธุรกิจ และการพัฒนาผู้เรียน"],
      ["ปฏิทินวิชาการ", "ภาคเรียน วันสำคัญ และช่วงกิจกรรมของวิทยาลัย"],
      ["เอกสารราชการ", "รายงาน แผนงาน ประกาศ และลิงก์ ITA"]
    ],
    highlights: [
      ["18", "ผลงานนวัตกรรม", "ทีมนักเรียนนำเสนอโครงงานเทคโนโลยีประยุกต์ทุกปี"],
      ["12", "ความร่วมมือภาคอุตสาหกรรม", "พันธมิตรสนับสนุนการเรียนรู้และฝึกประสบการณ์"],
      ["24/7", "บริการดูแลผู้เรียน", "แนะแนว ให้คำปรึกษา และเตรียมแฟ้มสะสมงานตลอดปี"]
    ],
    documentsList: [
      ["ปฏิทินวิชาการ 2569", "ปฏิทิน"],
      ["แผนปฏิบัติการประจำปี", "แผนงาน"],
      ["รายงานประเมินตนเอง", "คุณภาพ"],
      ["ITA และความโปร่งใส", "เผยแพร่"]
    ]
  },
  en: {
    campus: "RCAT Campus Information Center",
    portal: "Public relations portal",
    eyebrow: "Royal College of Applied Technology",
    siteName: "RCAT Education Website",
    intro:
      "Public information, admissions, programs, activities, official notices, and campus communication connected to the RCAT CMS.",
    admissionChip: "Open admissions 2026",
    announcementsButton: "View announcements",
    staffLogin: "Staff login",
    nav: ["Home", "Overview", "Departments", "News", "Announcements", "Contact"],
    heroChip: "Admissions, services, and college updates",
    heroTitle: "College information in a formal school-site layout.",
    heroDescription:
      "Explore admissions, academic departments, official announcements, public documents, and campus activities from a front page patterned after a Thai college website.",
    latestActivities: "Latest activities",
    publicDocuments: "Public documents",
    featuredNotice: "Featured Notice",
    academicCalendar: "Academic Calendar",
    calendarDescription: "Upcoming college dates and public activities.",
    overviewLabel: "College Overview",
    overviewTitle: "A public homepage for updates, information, and student services.",
    overviewDescription:
      "The page structure is tuned for an education website: readable, formal, and connected to CMS content.",
    directorTitle: "Office of the College Director",
    directorDescription:
      "Leadership, public communication, and institutional development updates are framed here.",
    departmentsLabel: "Academic Departments",
    departmentsTitle: "Featured learning areas and development pathways.",
    departmentsDescription:
      "Programs are displayed as formal department-style cards for students and families.",
    prideLabel: "Campus Pride",
    prideTitle: "Highlights, partnerships, and core services.",
    prideDescription: "A concise public-information view of the college strengths.",
    newsLabel: "News and Activities",
    newsTitle: "Latest public updates, activities, and featured stories.",
    newsDescription: "A college news board with a featured post and compact secondary updates.",
    posted: "Posted",
    announcements: "Announcements",
    documents: "Official Documents",
    services: "Student Services",
    contact: "Contact and Follow",
    contactAddress: "RCAT campus public relations office and admissions center",
    telephone: "Telephone",
    email: "Email",
    footerTitle: "RCAT Public Website",
    footerDescription:
      "Structured public communication for admissions, activities, official documents, and academic services.",
    backToTop: "Back to top",
    languageToast: "Language changed to EN",
    programs: programs.map((item) => [item.title, item.description]),
    quickLinks: quickLinks.map((item) => [item.title, item.description]),
    highlights: prideHighlights.map((item) => [item.value, item.title, item.description]),
    documentsList: documentLinks.map((item) => [item.title, item.category])
  }
};

export type PublicLanguageSource = typeof defaultPublicLanguageSource;


function SectionHeading({ label, title, description }: SectionHeadingProps) {
  return (
    <Stack spacing={0.8} sx={{ mb: 2.5 }}>
      <Typography
        sx={{
          color: "secondary.dark",
          fontSize: "0.78rem",
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase"
        }}
      >
        :: {label}
      </Typography>
      <Typography variant="h2">{title}</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
        {description}
      </Typography>
    </Stack>
  );
}

export default function PublicHomePage() {
  const { language } = useLanguage();
  const { data: languageSource = defaultPublicLanguageSource } = useQuery({
    queryKey: ["public-language-source"],
    queryFn: async () => loadPublicLanguageSource(defaultPublicLanguageSource)
  });
  const copy = languageSource[language];
  const isThai = language === "th";
  const { data, isLoading } = useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
  });

  const localizedPrograms = programs.map((program, index) => ({
    ...program,
    title: copy.programs[index][0],
    description: copy.programs[index][1]
  }));
  const localizedQuickLinks = quickLinks.map((item, index) => ({
    ...item,
    title: copy.quickLinks[index][0],
    description: copy.quickLinks[index][1]
  }));
  const localizedHighlights = prideHighlights.map((item, index) => ({
    ...item,
    value: copy.highlights[index][0],
    title: copy.highlights[index][1],
    description: copy.highlights[index][2]
  }));
  const localizedDocuments = documentLinks.map((item, index) => ({
    ...item,
    title: copy.documentsList[index][0],
    category: copy.documentsList[index][1]
  }));
  const publicContent = useMemo(() => {
    return (data?.content ?? [])
      .filter((item) => item.status === "published" || item.status === "scheduled")
      .sort((left, right) => dayjs(right.publishAt).valueOf() - dayjs(left.publishAt).valueOf())
      .slice(0, 5);
  }, [data]);

  const featuredStory = publicContent[0];
  const newsStories = publicContent.slice(1, 5);
  const events = (data?.events ?? [])
    .filter((event) => event.status === "confirmed" && (event.visibility ?? "public") === "public")
    .slice(0, 4);

  const announcementItems = useMemo(
    () =>
      publicContent
        .filter((item) => item.type === "announcement" || item.type === "page")
        .slice(0, 5)
        .map((item) => ({
          title: item.title,
          date: dayjs(item.publishAt).format("YYYY-MM-DD"),
          category: item.type,
          href: `/content/${item.slug}`
        })),
    [publicContent]
  );

  return (
    <Box id="top" sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Box
        sx={{
          bgcolor: "primary.dark",
          color: "white",
          borderBottom: "3px solid",
          borderColor: "secondary.main"
        }}
      >
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            sx={{ py: 1.1 }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.75, sm: 2 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <LocationOnOutlinedIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2">{copy.campus}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <LocalPhoneOutlinedIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2">(038) 000-000</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <MailOutlineRoundedIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2">info@rcat.ac.th</Typography>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="body2" sx={{ opacity: 0.88 }}>
                {copy.portal}
              </Typography>
              {socialLinks.map((item) => (
                <IconButton
                  key={item.label}
                  component="a"
                  href={item.href}
                  color="inherit"
                  size="small"
                  sx={{
                    border: "1px solid rgba(255, 255, 255, 0.22)",
                    bgcolor: "rgba(255, 255, 255, 0.06)"
                  }}
                >
                  {item.icon}
                </IconButton>
              ))}
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box sx={{ bgcolor: "white", borderBottom: "1px solid rgba(31, 90, 44, 0.14)" }}>
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", lg: "center" }}
            sx={{ py: { xs: 2.5, md: 3 } }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: { xs: 68, md: 84 },
                  height: { xs: 68, md: 84 },
                  borderRadius: 3,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.light",
                  border: "1px solid rgba(31, 90, 44, 0.12)"
                }}
              >
                <Box
                  component="img"
                  src={projectSettings.site.logoPath}
                  alt={projectSettings.site.logoAlt}
                  sx={{
                    width: { xs: 52, md: 64 },
                    height: { xs: 52, md: 64 },
                    objectFit: "contain"
                  }}
                />
              </Box>
              <Box>
                <Typography
                  sx={{
                    color: "secondary.dark",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    mb: 0.4
                  }}
                >
                  {copy.eyebrow}
                </Typography>
                <Typography
                  variant="h1"
                  sx={{ fontSize: { xs: "1.7rem", md: "2.4rem" }, lineHeight: 1.08 }}
                >
                  {getCmsSiteName() || copy.siteName}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.8, maxWidth: 820 }}>
                  {copy.intro}
                </Typography>
              </Box>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.2}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <Chip label={copy.admissionChip} color="secondary" />
              <Button
                variant="contained"
                href="/announcements"
                endIcon={<ArrowForwardOutlinedIcon />}
              >
                {copy.announcementsButton}
              </Button>
              <Button
                variant="outlined"
                href="/admin"
                startIcon={<AdminPanelSettingsOutlinedIcon />}
              >
                {copy.staffLogin}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <PublicMainMenu />

      {isLoading && <LinearProgress />}

      <Box component="main" sx={{ py: { xs: 2.5, md: 4.5 } }}>
        <Container maxWidth="xl">
          <Grid container spacing={3.2}>
            <Grid item xs={12} lg={8}>
              <Box
                component="section"
                sx={(theme) => ({
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 3,
                  minHeight: { xs: 360, md: 430 },
                  display: "flex",
                  alignItems: "flex-end",
                  p: { xs: 3, md: 4.5 },
                  color: "white",
                  backgroundImage: `linear-gradient(120deg, ${alpha(theme.palette.primary.dark, 0.94)} 0%, ${alpha(theme.palette.primary.main, 0.82)} 52%, ${alpha(theme.palette.secondary.dark, 0.68)} 100%), url("https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  boxShadow: "0 22px 42px rgba(31, 90, 44, 0.18)"
                })}
              >
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(12, 34, 14, 0.08) 0%, rgba(12, 34, 14, 0.55) 100%)"
                  }}
                />
                <Stack spacing={2.2} sx={{ position: "relative", zIndex: 1, maxWidth: 700 }}>
                  <Chip
                    icon={<SchoolOutlinedIcon />}
                    label={copy.heroChip}
                    sx={{
                      alignSelf: "flex-start",
                      bgcolor: "rgba(255, 255, 255, 0.14)",
                      color: "white",
                      border: "1px solid rgba(255, 255, 255, 0.22)"
                    }}
                  />
                  <Typography
                    variant="h1"
                    sx={{ fontSize: { xs: "2rem", md: "3.6rem" }, lineHeight: 1.03 }}
                  >
                    {copy.heroTitle}
                  </Typography>
                  <Typography sx={{ maxWidth: 620, color: "rgba(255, 255, 255, 0.84)" }}>
                    {copy.heroDescription}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="large"
                      href="/news"
                      endIcon={<ArrowForwardOutlinedIcon />}
                    >
                      {copy.latestActivities}
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      href="/announcements"
                      sx={{
                        color: "white",
                        borderColor: "rgba(255, 255, 255, 0.34)"
                      }}
                    >
                      {copy.publicDocuments}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Stack spacing={2.2} sx={{ height: "100%" }}>
                {featuredStory ? (
                  <Card
                    component="a"
                    href={`/content/${featuredStory.slug}`}
                    sx={{
                      display: "block",
                      bgcolor: "white",
                      borderTop: "5px solid",
                      borderColor: "secondary.main"
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography
                        sx={{
                          color: "secondary.dark",
                          fontWeight: 800,
                          fontSize: "0.8rem",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          mb: 1
                        }}
                      >
                        :: {copy.featuredNotice}
                      </Typography>
                      <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                        {featuredStory.title}
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1.2 }}>
                        {featuredStory.summary}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
                        <Chip
                          label={featuredStory.type}
                          size="small"
                          sx={{ textTransform: "capitalize" }}
                        />
                        <Typography color="text.secondary" variant="body2">
                          {formatDisplayDate(featuredStory.publishAt)}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ) : (
                  <Card
                    sx={{
                      bgcolor: "white",
                      borderTop: "5px solid",
                      borderColor: "secondary.main"
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                        No published CMS content yet
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1.2 }}>
                        Content will appear here after published records are processed.
                      </Typography>
                    </CardContent>
                  </Card>
                )}
                <Card
                  id="calendar"
                  sx={(theme) => ({
                    flex: 1,
                    color: theme.palette.text.primary,
                    background: `linear-gradient(180deg, ${theme.palette.primary.light} 0%, ${alpha(theme.palette.secondary.light, 0.62)} 100%)`
                  })}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography
                      sx={{
                        color: "secondary.dark",
                        fontWeight: 800,
                        fontSize: "0.8rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        mb: 1.2
                      }}
                    >
                      :: {copy.academicCalendar}
                    </Typography>
                    <Stack spacing={1.5}>
                      {events.map((event) => (
                        <Stack
                          key={event.id}
                          direction="row"
                          spacing={1.5}
                          alignItems="flex-start"
                          sx={{
                            p: 1.4,
                            borderRadius: 2,
                            bgcolor: "rgba(255, 255, 255, 0.76)"
                          }}
                        >
                          <Box
                            sx={{
                              width: 52,
                              height: 52,
                              borderRadius: 2,
                              display: "grid",
                              placeItems: "center",
                              bgcolor: "secondary.main",
                              color: "secondary.contrastText",
                              flex: "0 0 auto"
                            }}
                          >
                            <Typography fontWeight={900}>{dayjs(event.date).format("DD")}</Typography>
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={800}>{event.title}</Typography>
                            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                              {event.audience} {isThai ? "วันที่" : "at"}{" "}
                              {formatDisplayDateTime(event.date)}
                            </Typography>
                          </Box>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>

          <Grid container spacing={4} sx={{ mt: 0.5 }}>
            <Grid item xs={12} lg={8}>
              <Box component="section" id="overview">
                <SectionHeading
                  label={copy.overviewLabel}
                  title={copy.overviewTitle}
                  description={copy.overviewDescription}
                />
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={7}>
                    <Card sx={{ height: "100%" }}>
                      <CardContent sx={{ p: 3 }}>
                        <Typography variant="h3" sx={{ fontSize: "1.25rem" }}>
                          {copy.overviewLabel}
                        </Typography>
                        <Typography color="text.secondary" sx={{ mt: 1.4 }}>
                          {copy.intro}
                        </Typography>
                        <Grid container spacing={1.5} sx={{ mt: 2 }}>
                          {localizedQuickLinks.map((item) => (
                            <Grid item xs={12} sm={6} key={item.title}>
                              <Box
                                component="a"
                                href={item.href}
                                sx={{
                                  display: "block",
                                  p: 1.8,
                                  borderRadius: 2,
                                  bgcolor: "background.default",
                                  border: "1px solid rgba(31, 90, 44, 0.12)"
                                }}
                              >
                                <Stack direction="row" spacing={1.2} alignItems="flex-start">
                                  <Box
                                    sx={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: 1.6,
                                      display: "grid",
                                      placeItems: "center",
                                      bgcolor: "primary.light",
                                      color: "primary.main",
                                      flex: "0 0 auto"
                                    }}
                                  >
                                    {item.icon}
                                  </Box>
                                  <Box>
                                    <Typography fontWeight={800}>{item.title}</Typography>
                                    <Typography color="text.secondary" variant="body2" sx={{ mt: 0.4 }}>
                                      {item.description}
                                    </Typography>
                                  </Box>
                                </Stack>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <Card
                      sx={{
                        height: "100%",
                        background:
                          "linear-gradient(180deg, rgba(232, 245, 233, 0.95) 0%, rgba(255, 255, 255, 1) 100%)"
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Typography
                          sx={{
                            color: "secondary.dark",
                            fontWeight: 800,
                            fontSize: "0.8rem",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            mb: 1
                          }}
                        >
                          :: {copy.directorTitle}
                        </Typography>
                        <Box
                          sx={{
                            width: "100%",
                            minHeight: 180,
                            borderRadius: 2.5,
                            display: "grid",
                            placeItems: "center",
                            background:
                              "linear-gradient(135deg, rgba(44, 122, 63, 0.15) 0%, rgba(255, 244, 194, 0.82) 100%)"
                          }}
                        >
                          <SchoolOutlinedIcon sx={{ fontSize: 88, color: "primary.dark" }} />
                        </Box>
                        <Typography variant="h3" sx={{ fontSize: "1.2rem", mt: 2 }}>
                          {copy.directorTitle}
                        </Typography>
                        <Typography color="text.secondary" sx={{ mt: 1 }}>
                          {copy.directorDescription}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>

              <Box component="section" id="departments" sx={{ mt: 5 }}>
                <SectionHeading
                  label={copy.departmentsLabel}
                  title={copy.departmentsTitle}
                  description={copy.departmentsDescription}
                />
                <Grid container spacing={2.5}>
                  {localizedPrograms.map((program) => (
                    <Grid item xs={12} md={4} key={program.title}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent sx={{ p: 2.7 }}>
                          <Box
                            sx={{
                              width: 54,
                              height: 54,
                              borderRadius: 2,
                              display: "grid",
                              placeItems: "center",
                              color: "primary.main",
                              bgcolor: "primary.light",
                              mb: 2
                            }}
                          >
                            {program.icon}
                          </Box>
                          <Typography variant="h3">{program.title}</Typography>
                          <Typography color="text.secondary" sx={{ mt: 1 }}>
                            {program.description}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              <Box component="section" sx={{ mt: 5 }}>
                <SectionHeading
                  label={copy.prideLabel}
                  title={copy.prideTitle}
                  description={copy.prideDescription}
                />
                <Grid container spacing={2.5}>
                  {localizedHighlights.map((item) => (
                    <Grid item xs={12} md={4} key={item.title}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent sx={{ p: 2.7 }}>
                          <Stack direction="row" spacing={1.4} alignItems="center">
                            <Box
                              sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 2,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: "secondary.light",
                                color: "secondary.dark"
                              }}
                            >
                              {item.icon}
                            </Box>
                            <Box>
                              <Typography
                                sx={{ fontSize: "1.45rem", fontWeight: 900, color: "primary.dark" }}
                              >
                                {item.value}
                              </Typography>
                              <Typography fontWeight={800}>{item.title}</Typography>
                            </Box>
                          </Stack>
                          <Typography color="text.secondary" sx={{ mt: 1.6 }}>
                            {item.description}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              <Box component="section" id="news" sx={{ mt: 5 }}>
                <SectionHeading
                  label={copy.newsLabel}
                  title={copy.newsTitle}
                  description={copy.newsDescription}
                />
                <Grid container spacing={2.5}>
                  {featuredStory ? (
                    <Grid item xs={12}>
                      <Card component="a" href={`/content/${featuredStory.slug}`} sx={{ display: "block" }}>
                        <CardContent sx={{ p: 2.8 }}>
                          <Grid container spacing={2.5} alignItems="stretch">
                            <Grid item xs={12} md={4}>
                              <Box
                                sx={(theme) => ({
                                  height: "100%",
                                  minHeight: 220,
                                  borderRadius: 2.5,
                                  display: "grid",
                                  placeItems: "center",
                                  color: theme.palette.primary.dark,
                                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.98)} 0%, ${alpha(theme.palette.secondary.light, 0.92)} 100%)`
                                })}
                              >
                                <CampaignOutlinedIcon sx={{ fontSize: 84 }} />
                              </Box>
                            </Grid>
                            <Grid item xs={12} md={8}>
                              <Chip
                                icon={<ArticleOutlinedIcon />}
                                label={featuredStory.type}
                                size="small"
                                sx={{ textTransform: "capitalize" }}
                              />
                              <Typography variant="h3" sx={{ fontSize: "1.5rem", mt: 1.25 }}>
                                {featuredStory.title}
                              </Typography>
                              <Typography color="text.secondary" sx={{ mt: 1.2 }}>
                                {featuredStory.summary}
                              </Typography>
                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                justifyContent="space-between"
                                sx={{ mt: 2.5 }}
                              >
                                <Typography color="text.secondary" variant="body2">
                                  {featuredStory.owner}
                                </Typography>
                                <Typography color="text.secondary" variant="body2">
                                  {copy.posted} {formatDisplayDate(featuredStory.publishAt)}
                                </Typography>
                              </Stack>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  ) : (
                    <Grid item xs={12}>
                      <Card>
                        <CardContent sx={{ p: 2.8 }}>
                          <Typography color="text.secondary">
                            No published CMS content is available yet.
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  {newsStories.map((item) => (
                    <Grid item xs={12} md={6} key={item.id}>
                      <Card
                        component="a"
                        href={`/content/${item.slug}`}
                        sx={{
                          display: "block",
                          height: "100%"
                        }}
                      >
                        <CardContent sx={{ p: 2.2 }}>
                          <Stack direction="row" spacing={1.5}>
                            <Box
                              sx={{
                                width: 88,
                                minWidth: 88,
                                height: 88,
                                borderRadius: 2,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: "primary.light",
                                color: "primary.main"
                              }}
                            >
                              <ArticleOutlinedIcon />
                            </Box>
                            <Box>
                              <Typography
                                sx={{
                                  color: "secondary.dark",
                                  fontSize: "0.75rem",
                                  fontWeight: 800,
                                  letterSpacing: "0.12em",
                                  textTransform: "uppercase",
                                  mb: 0.5
                                }}
                              >
                                {item.type}
                              </Typography>
                              <Typography variant="h3" sx={{ fontSize: "1.05rem" }}>
                                {item.title}
                              </Typography>
                              <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                                {item.summary}
                              </Typography>
                              <Typography
                                color="text.secondary"
                                variant="caption"
                                sx={{ mt: 1.25, display: "block" }}
                              >
                                {formatDisplayDate(item.publishAt)}
                              </Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Stack spacing={2.5}>
                <Card id="announcements">
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography
                      sx={{
                        color: "secondary.dark",
                        fontWeight: 800,
                        fontSize: "0.8rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        mb: 1
                      }}
                    >
                      :: {copy.announcements}
                    </Typography>
                    <Stack divider={<Divider flexItem />} spacing={0}>
                      {announcementItems.map((item) => (
                        <Box
                          key={`${item.title}-${item.date}`}
                          component="a"
                          href={item.href}
                          sx={{ display: "block", py: 1.5 }}
                        >
                          <Chip
                            label={item.category}
                            size="small"
                            sx={{ mb: 1, textTransform: "capitalize" }}
                          />
                          <Typography fontWeight={800}>{item.title}</Typography>
                          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.6 }}>
                            {formatDisplayDate(item.date)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                <Card id="documents">
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography
                      sx={{
                        color: "secondary.dark",
                        fontWeight: 800,
                        fontSize: "0.8rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        mb: 1
                      }}
                    >
                      :: {copy.documents}
                    </Typography>
                    <Stack spacing={1.1}>
                      {localizedDocuments.map((item) => (
                        <Box
                          key={item.title}
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: "background.default",
                            border: "1px solid rgba(31, 90, 44, 0.12)"
                          }}
                        >
                          <Stack direction="row" spacing={1.2} alignItems="flex-start">
                            <DescriptionOutlinedIcon sx={{ color: "primary.main", mt: 0.2 }} />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography fontWeight={800}>{item.title}</Typography>
                              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.45 }}>
                                {item.category}
                              </Typography>
                            </Box>
                            <NavigateNextRoundedIcon sx={{ color: "text.secondary" }} />
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography
                      sx={{
                        color: "secondary.dark",
                        fontWeight: 800,
                        fontSize: "0.8rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        mb: 1
                      }}
                    >
                      :: {copy.services}
                    </Typography>
                    <Stack spacing={1.25}>
                      {localizedQuickLinks.map((item) => (
                        <Box
                          key={item.title}
                          component="a"
                          href={item.href}
                          sx={{
                            p: 1.4,
                            borderRadius: 2,
                            bgcolor: "background.default",
                            border: "1px solid rgba(31, 90, 44, 0.12)"
                          }}
                        >
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Box
                              sx={{
                                width: 38,
                                height: 38,
                                borderRadius: 1.5,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: "primary.light",
                                color: "primary.main",
                                flex: "0 0 auto"
                              }}
                            >
                              {item.icon}
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography fontWeight={800}>{item.title}</Typography>
                              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.3 }}>
                                {item.description}
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                <Card id="contact">
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography
                      sx={{
                        color: "secondary.dark",
                        fontWeight: 800,
                        fontSize: "0.8rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        mb: 1
                      }}
                    >
                      :: {copy.contact}
                    </Typography>
                    <Stack spacing={1.1}>
                      <Stack direction="row" spacing={1.2} alignItems="flex-start">
                        <LocationOnOutlinedIcon color="primary" />
                        <Typography color="text.secondary" variant="body2">
                          {copy.contactAddress}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.2} alignItems="flex-start">
                        <LocalPhoneOutlinedIcon color="primary" />
                        <Typography color="text.secondary" variant="body2">
                          {copy.telephone}: (038) 000-000
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.2} alignItems="flex-start">
                        <MailOutlineRoundedIcon color="primary" />
                        <Typography color="text.secondary" variant="body2">
                          {copy.email}: info@rcat.ac.th
                        </Typography>
                      </Stack>
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {socialLinks.map((item) => (
                        <Button
                          key={item.label}
                          component="a"
                          href={item.href}
                          variant="outlined"
                          color="inherit"
                          startIcon={item.icon}
                          sx={{ borderColor: "rgba(31, 90, 44, 0.12)" }}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box component="footer" sx={{ py: 4.5, bgcolor: "primary.dark", color: "white", mt: 2 }}>
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography fontWeight={900} sx={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {copy.footerTitle}
              </Typography>
              <Typography sx={{ color: "rgba(255, 255, 255, 0.76)", mt: 0.6, maxWidth: 680 }}>
                {copy.footerDescription}
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
              <Button color="inherit" href="#top">
                {copy.backToTop}
              </Button>
              <Button color="inherit" href="/login" startIcon={<AdminPanelSettingsOutlinedIcon />}>
                {copy.staffLogin}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
