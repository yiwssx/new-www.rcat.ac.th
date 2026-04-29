import { useMemo } from "react";
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
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import FaxOutlinedIcon from "@mui/icons-material/FaxOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import dayjs from "dayjs";
import EmptyState from "../../shared/components/EmptyState";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { ContentItem, PublicMenuItem } from "../../types";
import { formatDisplayDate, formatDisplayDateTime } from "../../utils/dateDisplay";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { contentTypeLabels } from "../../utils/thaiLabels";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

interface SectionHeadingProps {
  label: string;
  title: string;
  description?: string;
}

interface QuickLink {
  label: string;
  href: string;
}

const quickLinkFallback: QuickLink[] = [
  { label: "ประกาศ", href: "/announcements" },
  { label: "ข่าว", href: "/news" },
  { label: "ติดต่อ", href: "/contact" }
];

const documentKeywords = ["เอกสาร", "document", "ita", "แผนงาน", "ประกันคุณภาพ"];
const highlightKeywords = ["highlight", "จุดเด่น"];

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
      {description && (
        <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
          {description}
        </Typography>
      )}
    </Stack>
  );
}

function sortByPublishDate(items: ContentItem[]) {
  return [...items].sort((left, right) => dayjs(right.publishAt).valueOf() - dayjs(left.publishAt).valueOf());
}

function hasContentKeyword(item: ContentItem, keywords: string[]) {
  const haystack = [item.category, ...(item.tags ?? [])]
    .join(" ")
    .toLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function collectMenuLinks(items: PublicMenuItem[] | undefined): QuickLink[] {
  const links: QuickLink[] = [];

  function visit(menuItems: PublicMenuItem[]) {
    menuItems.forEach((item) => {
      if (!item.enabled) {
        return;
      }

      if (item.label && item.href) {
        links.push({
          label: item.label,
          href: item.href
        });
      }

      if (item.children?.length) {
        visit(item.children);
      }
    });
  }

  visit(items ?? []);
  return links.length ? links.slice(0, 6) : quickLinkFallback;
}

export default function PublicHomePage() {
  const { data, isLoading } = usePublicCmsSnapshot();
  const siteSettings = normalizeSiteSettings(data?.siteSettings);
  const publicContent = useMemo(
    () => sortByPublishDate((data?.content ?? []).filter((item) => item.status === "published")),
    [data]
  );
  const featuredStory = publicContent.find((item) => item.featured) ?? publicContent[0];
  const newsItems = publicContent
    .filter((item) => item.type === "news" || item.type === "blog")
    .slice(0, 4);
  const announcementItems = publicContent.filter((item) => item.type === "announcement").slice(0, 5);
  const programItems = publicContent.filter((item) => item.type === "program").slice(0, 6);
  const documentItems = publicContent.filter((item) => item.type === "page" && hasContentKeyword(item, documentKeywords)).slice(0, 6);
  const highlightItems = publicContent.filter((item) => hasContentKeyword(item, highlightKeywords)).slice(0, 3);
  const quickLinks = collectMenuLinks(data?.menu);
  const events = (data?.events ?? [])
    .filter((event) => event.status === "confirmed" && (event.visibility ?? "public") === "public")
    .slice(0, 4);
  const heroImageLayer = siteSettings.heroImageUrl ? `, url(${JSON.stringify(siteSettings.heroImageUrl)})` : "";
  const hasDirectorCard = Boolean(siteSettings.directorName || siteSettings.directorDescription);
  const hasContactInfo = Boolean(
    siteSettings.campus ||
      siteSettings.address ||
      siteSettings.phone ||
      siteSettings.fax ||
      siteSettings.email
  );

  return (
    <PublicSiteShell
      hidePageHeader
      disableMainContainer
      seoDescription={siteSettings.heroDescription || siteSettings.intro}
      canonicalPath="/"
    >
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
                backgroundImage: `linear-gradient(120deg, ${alpha(theme.palette.primary.dark, 0.94)} 0%, ${alpha(theme.palette.primary.main, 0.82)} 52%, ${alpha(theme.palette.secondary.dark, 0.68)} 100%)${heroImageLayer}`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: "0 22px 42px rgba(31, 90, 44, 0.18)"
              })}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(12, 34, 14, 0.08) 0%, rgba(12, 34, 14, 0.55) 100%)"
                }}
              />
              <Stack spacing={2.2} sx={{ position: "relative", zIndex: 1, maxWidth: 700 }}>
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
                <Typography variant="h1" sx={{ fontSize: { xs: "2rem", md: "3.6rem" }, lineHeight: 1.03 }}>
                  {siteSettings.heroTitle}
                </Typography>
                {siteSettings.heroDescription && (
                  <Typography sx={{ maxWidth: 620, color: "rgba(255, 255, 255, 0.84)" }}>
                    {siteSettings.heroDescription}
                  </Typography>
                )}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                  <Button variant="contained" color="secondary" size="large" href={normalizeSafeHref("/news")} endIcon={<ArrowForwardOutlinedIcon />}>
                    ข่าวล่าสุด
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    href={normalizeSafeHref("/announcements")}
                    sx={{
                      color: "white",
                      borderColor: "rgba(255, 255, 255, 0.34)"
                    }}
                  >
                    ประกาศ
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
                  href={normalizeSafeHref(`/content/${featuredStory.slug}`)}
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
                      :: เนื้อหาเด่น
                    </Typography>
                    <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                      {featuredStory.title}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1.2 }}>
                      {featuredStory.summary}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
                      <Chip label={contentTypeLabels[featuredStory.type]} size="small" sx={{ textTransform: "capitalize" }} />
                      <Typography color="text.secondary" variant="body2">
                        {formatDisplayDate(featuredStory.publishAt)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ) : (
                <EmptyState title="ยังไม่มีเนื้อหาที่เผยแพร่" icon={<ArticleOutlinedIcon />} />
              )}
              <Card id="calendar">
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <EventAvailableOutlinedIcon color="primary" />
                    <Typography variant="h3">กำหนดการ</Typography>
                  </Stack>
                  {events.length ? (
                    <Stack divider={<Divider flexItem />} spacing={0}>
                      {events.map((event) => (
                        <Box key={event.id} sx={{ py: 1.4 }}>
                          <Typography fontWeight={900}>{event.title}</Typography>
                          <Typography color="text.secondary" variant="body2">
                            {formatDisplayDateTime(event.date)}
                          </Typography>
                          {event.location && (
                            <Typography color="text.secondary" variant="body2">
                              {event.location}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <EmptyState title="ยังไม่มีกิจกรรมที่เผยแพร่" icon={<EventAvailableOutlinedIcon />} />
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        <Box component="section" sx={{ mt: 5 }}>
          <SectionHeading label="เมนูด่วน" title="ลิงก์ที่เกี่ยวข้อง" />
          <Grid container spacing={2}>
            {quickLinks.map((item) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={`${item.href}-${item.label}`}>
                <Card component="a" href={normalizeSafeHref(item.href)} sx={{ display: "block", height: "100%" }}>
                  <CardContent sx={{ p: 2.2 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1.5,
                          display: "grid",
                          placeItems: "center",
                          bgcolor: "primary.light",
                          color: "primary.main",
                          flex: "0 0 auto"
                        }}
                      >
                        <NavigateNextRoundedIcon />
                      </Box>
                      <Typography fontWeight={900}>{item.label}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Grid container spacing={3.2} sx={{ mt: 2 }}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Box component="section" id="departments" sx={{ mt: 3 }}>
              <SectionHeading label="หลักสูตร" title="ข้อมูลหลักสูตรที่เผยแพร่" />
              {programItems.length ? (
                <Grid container spacing={2.5}>
                  {programItems.map((item) => (
                    <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                      <PublicContentCard item={item} mediaAssets={data?.media ?? []} icon={<SchoolOutlinedIcon sx={{ fontSize: 42 }} />} />
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <EmptyState title="ยังไม่มีข้อมูลหลักสูตรที่เผยแพร่" icon={<SchoolOutlinedIcon />} />
              )}
            </Box>

            {!!highlightItems.length && (
              <Box component="section" sx={{ mt: 5 }}>
                <SectionHeading label="จุดเด่น" title="เนื้อหาแนะนำ" />
                <Grid container spacing={2.5}>
                  {highlightItems.map((item) => (
                    <Grid size={{ xs: 12, md: 4 }} key={item.id}>
                      <PublicContentCard item={item} mediaAssets={data?.media ?? []} />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            <Box component="section" id="news" sx={{ mt: 5 }}>
              <SectionHeading label="ข่าว" title="ข่าวและบทความล่าสุด" />
              {newsItems.length ? (
                <Grid container spacing={2.5}>
                  {newsItems.map((item) => (
                    <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                      <PublicContentCard item={item} mediaAssets={data?.media ?? []} icon={<CampaignOutlinedIcon sx={{ fontSize: 42 }} />} />
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <EmptyState title="ยังไม่มีข่าวที่เผยแพร่" icon={<ArticleOutlinedIcon />} />
              )}
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Stack spacing={2.5} sx={{ mt: 3 }}>
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
                    :: ประกาศ
                  </Typography>
                  {announcementItems.length ? (
                    <Stack divider={<Divider flexItem />} spacing={0}>
                      {announcementItems.map((item) => (
                        <Box
                          key={item.id}
                          component="a"
                          href={normalizeSafeHref(`/content/${item.slug}`)}
                          sx={{ display: "block", py: 1.5 }}
                        >
                          <Typography fontWeight={800}>{item.title}</Typography>
                          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.6 }}>
                            {formatDisplayDate(item.publishAt)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <EmptyState title="ยังไม่มีประกาศที่เผยแพร่" icon={<CampaignOutlinedIcon />} />
                  )}
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
                    :: เอกสารเผยแพร่
                  </Typography>
                  {documentItems.length ? (
                    <Stack spacing={1.1}>
                      {documentItems.map((item) => (
                        <Box
                          key={item.id}
                          component="a"
                          href={normalizeSafeHref(`/content/${item.slug}`)}
                          sx={{
                            p: 1.5,
                            display: "block",
                            borderRadius: 2,
                            bgcolor: "background.default",
                            border: "1px solid rgba(31, 90, 44, 0.12)"
                          }}
                        >
                          <Stack direction="row" spacing={1.2} alignItems="flex-start">
                            <DescriptionOutlinedIcon sx={{ color: "primary.main", mt: 0.2 }} />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography fontWeight={800}>{item.title}</Typography>
                              {item.category && (
                                <Typography color="text.secondary" variant="body2" sx={{ mt: 0.45 }}>
                                  {item.category}
                                </Typography>
                              )}
                            </Box>
                            <NavigateNextRoundedIcon sx={{ color: "text.secondary" }} />
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <EmptyState title="ยังไม่มีเอกสารเผยแพร่" icon={<DescriptionOutlinedIcon />} />
                  )}
                </CardContent>
              </Card>

              {hasDirectorCard && (
                <Card>
                  <CardContent sx={{ p: 2.5 }}>
                    {siteSettings.directorTitle && (
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
                        :: {siteSettings.directorTitle}
                      </Typography>
                    )}
                    <Box
                      sx={(theme) => ({
                        minHeight: 120,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: alpha(theme.palette.primary.light, 0.82)
                      })}
                    >
                      <SchoolOutlinedIcon sx={{ fontSize: 72, color: "primary.dark" }} />
                    </Box>
                    {siteSettings.directorName && (
                      <Typography variant="h3" sx={{ fontSize: "1.2rem", mt: 2 }}>
                        {siteSettings.directorName}
                      </Typography>
                    )}
                    {siteSettings.directorDescription && (
                      <Typography color="text.secondary" sx={{ fontSize: "0.875rem", mt: 1 }}>
                        {siteSettings.directorDescription}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              )}

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
                    :: ติดต่อ
                  </Typography>
                  {hasContactInfo ? (
                    <Stack spacing={1.1}>
                      {(siteSettings.campus || siteSettings.address) && (
                        <Stack direction="row" spacing={1.2} alignItems="flex-start">
                          <LocationOnOutlinedIcon color="primary" />
                          <Typography color="text.secondary" variant="body2" sx={{ whiteSpace: "pre-line" }}>
                            {[siteSettings.campus, siteSettings.address].filter(Boolean).join("\n")}
                          </Typography>
                        </Stack>
                      )}
                      {(siteSettings.phone || siteSettings.fax) && (
                        <Stack direction="row" spacing={1.2} alignItems="flex-start">
                          <LocalPhoneOutlinedIcon color="primary" />
                          <Typography color="text.secondary" variant="body2">
                            {[siteSettings.phone]}
                          </Typography>
                          <FaxOutlinedIcon color="primary" />
                          <Typography color="text.secondary" variant="body2">
                            {[siteSettings.fax]}
                          </Typography>
                        </Stack>
                      )}
                      {siteSettings.email && (
                        <Stack direction="row" spacing={1.2} alignItems="flex-start">
                          <MailOutlineRoundedIcon color="primary" />
                          <Typography color="text.secondary" variant="body2">
                            {siteSettings.email}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  ) : (
                    <EmptyState title="ยังไม่มีข้อมูลติดต่อ" icon={<FaxOutlinedIcon />} />
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </PublicSiteShell>
  );
}
