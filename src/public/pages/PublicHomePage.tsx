import { ReactNode, useMemo } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import FacebookRoundedIcon from "@mui/icons-material/FacebookRounded";
import FaxOutlinedIcon from '@mui/icons-material/FaxOutlined';
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
import PublicSiteShell from "../components/PublicSiteShell";
import PublicTextSetting from "../../config/projectTextElementSetting";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTiktok } from '@fortawesome/free-brands-svg-icons';
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";
import { formatDisplayDate, formatDisplayDateTime } from "../../utils/dateDisplay";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { contentTypeLabels } from "../../utils/thaiLabels";

interface SectionHeadingProps {
  label: string;
  title: string;
  description: string;
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
    title: "เทคโนโลยีวิศวกรรม",
    description: "ระบบอัตโนมัติ หุ่นยนต์ อิเล็กทรอนิกส์ และงานโครงงานประยุกต์",
    icon: <EngineeringOutlinedIcon />
  },
  {
    title: "ธุรกิจดิจิทัล",
    description: "การตลาด ผู้ประกอบการ การวิเคราะห์ข้อมูล และระบบธุรกิจใช้งานจริง",
    icon: <AutoStoriesOutlinedIcon />
  },
  {
    title: "พัฒนาผู้เรียน",
    description: "กิจกรรม แนะแนว แฟ้มสะสมผลงาน และการเตรียมความพร้อมสู่อาชีพ",
    icon: <GroupsOutlinedIcon />
  }
];

const quickLinks: QuickLink[] = [
  {
    title: "การรับสมัคร",
    description: "ช่วงเวลารับสมัคร คุณสมบัติ และเอกสารที่ต้องใช้",
    href: "/announcements",
    icon: <SchoolOutlinedIcon />
  },
  {
    title: "หลักสูตร",
    description: "เส้นทางการเรียนด้านเทคนิค ธุรกิจ และการพัฒนาผู้เรียน",
    href: "/departments",
    icon: <AutoStoriesOutlinedIcon />
  },
  {
    title: "ปฏิทินวิชาการ",
    description: "กำหนดการภาคเรียน กิจกรรม และช่วงเวลาสำคัญของสถานศึกษา",
    href: "#calendar",
    icon: <EventAvailableOutlinedIcon />
  },
  {
    title: "เอกสารราชการ",
    description: "รายงาน เอกสารประกันคุณภาพ ประกาศ และข้อมูล ITA",
    href: "/announcements",
    icon: <DescriptionOutlinedIcon />
  }
];

const prideHighlights: PrideHighlight[] = [
  {
    value: "18",
    title: "ผลงานนวัตกรรม",
    description: "ทีมผู้เรียนนำเสนอผลงานวิศวกรรมและเทคโนโลยีประยุกต์เป็นประจำทุกปี",
    icon: <WorkspacePremiumOutlinedIcon />
  },
  {
    value: "12",
    title: "ความร่วมมือภาคอุตสาหกรรม",
    description: "เครือข่ายการเรียนรู้ร่วมสถานประกอบการช่วยสร้างทักษะใช้งานจริง",
    icon: <EngineeringOutlinedIcon />
  },
  {
    value: "24/7",
    title: "บริการช่วยเหลือนักเรียน",
    description: "มีการแนะแนว ให้คำปรึกษา และสนับสนุนแฟ้มสะสมผลงานตลอดปี",
    icon: <GroupsOutlinedIcon />
  }
];

const documentLinks: DocumentLink[] = [
  {
    title: "ปฏิทินวิชาการ 2026",
    category: "ปฏิทิน"
  },
  {
    title: "แผนปฏิบัติการประจำปี",
    category: "แผนงาน"
  },
  {
    title: "รายงานการประเมินตนเอง",
    category: "ประกันคุณภาพ"
  },
  {
    title: "ITA และข้อมูลความโปร่งใส",
    category: "ข้อมูลสาธารณะ"
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
    label: "TikTok",
    href: "https://www.tiktok.com/",
    icon: <FontAwesomeIcon icon={faTiktok} style={{ fontSize: "1.25rem" }} />
  }
  ];

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
  const publicText = PublicTextSetting;
  const { data, isLoading } = usePublicCmsSnapshot();

  const localizedPrograms = programs;
  const localizedQuickLinks = quickLinks;
  const localizedHighlights = prideHighlights;
  const localizedDocuments = documentLinks;
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
          category: contentTypeLabels[item.type],
          href: `/content/${item.slug}`
        })),
    [publicContent]
  );

  return (
    <PublicSiteShell hidePageHeader disableMainContainer seoDescription={publicText.intro} canonicalPath="/">
      {isLoading && <LinearProgress />}
      <Container maxWidth="xl">
          <Grid container spacing={3.2}>
            <Grid size={{ xs: 12, lg: 8 }}>
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
                    label={publicText.heroChip}
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
                    {publicText.heroTitle}
                  </Typography>
                  <Typography sx={{ maxWidth: 620, color: "rgba(255, 255, 255, 0.84)" }}>
                    {publicText.heroDescription}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="large"
                      href="/news"
                      endIcon={<ArrowForwardOutlinedIcon />}
                    >
                      {publicText.latestActivities}
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
                      {publicText.publicDocuments}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
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
                        :: {publicText.featuredNotice}
                      </Typography>
                      <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                        {featuredStory.title}
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1.2 }}>
                        {featuredStory.summary}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
                        <Chip
                          label={contentTypeLabels[featuredStory.type]}
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
                        ยังไม่มีเนื้อหาที่เผยแพร่
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1.2 }}>
                        เนื้อหาจะแสดงที่นี่หลังจากมีรายการที่เผยแพร่แล้ว
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
                      :: {publicText.academicCalendar}
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
                              {event.audience}{"at"}
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
            <Grid size={{ xs: 12, lg: 8 }}>
              <Box component="section" id="overview">
                <SectionHeading
                  label={publicText.overviewLabel}
                  title={publicText.overviewTitle}
                  description={publicText.overviewDescription}
                />
                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <Card sx={{ height: "100%" }}>
                      <CardContent sx={{ p: 3 }}>
                        <Typography variant="h3" sx={{ fontSize: "1.25rem" }}>
                          {publicText.overviewLabel}
                        </Typography>
                        <Typography color="text.secondary" sx={{ mt: 1.4 }}>
                          {publicText.intro}
                        </Typography>
                        <Grid container spacing={1.5} sx={{ mt: 2 }}>
                          {localizedQuickLinks.map((item) => (
                            <Grid size={{ xs: 12, sm: 6 }} key={item.title}>
                              <Box
                                component="a"
                                href={normalizeSafeHref(item.href)}
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
                  <Grid size={{ xs: 12, md: 5 }}>
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
                          :: {publicText.directorTitle}
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
                          {publicText.directorName}
                        </Typography>
                        <Typography color="text.secondary" sx={{ fontSize: "0.875rem", mt: 1 }}>
                          {publicText.directorDescription}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>

              <Box component="section" id="departments" sx={{ mt: 5 }}>
                <SectionHeading
                  label={publicText.departmentsLabel}
                  title={publicText.departmentsTitle}
                  description={publicText.departmentsDescription}
                />
                <Grid container spacing={2.5}>
                  {localizedPrograms.map((program) => (
                    <Grid size={{ xs: 12, md: 4 }} key={program.title}>
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
                  label={publicText.prideLabel}
                  title={publicText.prideTitle}
                  description={publicText.prideDescription}
                />
                <Grid container spacing={2.5}>
                  {localizedHighlights.map((item) => (
                    <Grid size={{ xs: 12, md: 4 }} key={item.title}>
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
                  label={publicText.newsLabel}
                  title={publicText.newsTitle}
                  description={publicText.newsDescription}
                />
                <Grid container spacing={2.5}>
                  {featuredStory ? (
                    <Grid size={{ xs: 12 }}>
                      <Card component="a" href={`/content/${featuredStory.slug}`} sx={{ display: "block" }}>
                        <CardContent sx={{ p: 2.8 }}>
                          <Grid container spacing={2.5} alignItems="stretch">
                            <Grid size={{ xs: 12, md: 4 }}>
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
                            <Grid size={{ xs: 12, md: 8 }}>
                              <Chip
                                icon={<ArticleOutlinedIcon />}
                                label={contentTypeLabels[featuredStory.type]}
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
                                  {publicText.posted} {formatDisplayDate(featuredStory.publishAt)}
                                </Typography>
                              </Stack>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  ) : (
                    <Grid size={{ xs: 12 }}>
                      <Card>
                        <CardContent sx={{ p: 2.8 }}>
                          <Typography color="text.secondary">
                            ยังไม่มีเนื้อหา CMS ที่เผยแพร่ในขณะนี้
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  {newsStories.map((item) => (
                    <Grid size={{ xs: 12, md: 6 }} key={item.id}>
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
                                {contentTypeLabels[item.type]}
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
            <Grid size={{ xs: 12, lg: 4 }}>
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
                      :: {publicText.announcements}
                    </Typography>
                    <Stack divider={<Divider flexItem />} spacing={0}>
                      {announcementItems.map((item) => (
                        <Box
                          key={`${item.title}-${item.date}`}
                          component="a"
                          href={normalizeSafeHref(item.href)}
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
                      :: {publicText.documents}
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
                      :: {publicText.services}
                    </Typography>
                    <Stack spacing={1.25}>
                      {localizedQuickLinks.map((item) => (
                        <Box
                          key={item.title}
                          component="a"
                          href={normalizeSafeHref(item.href)}
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
                      :: {publicText.contact}
                    </Typography>
                    <Stack spacing={1.1}>
                      <Stack direction="row" spacing={1.2} alignItems="flex-start">
                        <LocationOnOutlinedIcon color="primary" />
                        <Typography color="text.secondary" variant="body2">
                          {publicText.campus}
                            <br />
                          {publicText.contactAddress}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.2} alignItems="flex-start">
                        <LocalPhoneOutlinedIcon color="primary" />
                        <Typography color="text.secondary" variant="body2">
                          {publicText.telephone}: 0 4356 9117
                        </Typography>
                        <FaxOutlinedIcon color="primary" />
                        <Typography color="text.secondary" variant="body2">
                          {publicText.fax}: 0 4356 9118
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.2} alignItems="flex-start">
                        <MailOutlineRoundedIcon color="primary" />
                        <Typography color="text.secondary" variant="body2">
                          {publicText.email}: saraban@rcat.ac.th
                        </Typography>
                      </Stack>
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {socialLinks.map((item) => (
                        <Button
                          key={item.label}
                          component="a"
                          href={normalizeSafeHref(item.href)}
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
    </PublicSiteShell>
  );
}
