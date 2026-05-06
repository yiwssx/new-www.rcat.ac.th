import { useMemo } from "react";
import { Box, Button, Chip, Container, LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import dayjs from "dayjs";
import EmptyState from "../../shared/components/EmptyState";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { CalendarEvent, ContentItem } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";
import PublicContentCard from "../components/PublicContentCard";
import PublicHomeCarousel from "../components/PublicHomeCarousel";
import PublicSiteShell from "../components/PublicSiteShell";
import { AchievementHighlightsSection } from "../components/home/AchievementHighlightsSection";
import { ContactMapCard } from "../components/home/ContactMapCard";
import { DirectorHeroCard } from "../components/home/DirectorHeroCard";
import { DocumentListCard } from "../components/home/DocumentListCard";
import { EventListCard } from "../components/home/EventListCard";
import { HomeSectionHeading } from "../components/home/HomeSectionHeading";
import { LatestAnnouncementsCard } from "../components/home/LatestAnnouncementsCard";
import { ProcurementNewsSection } from "../components/home/ProcurementNewsSection";
import { ExternalServicesSection } from "../components/home/ExternalServicesSection";
import { UrgentMarqueeSection } from "../components/home/UrgentMarqueeSection";
import { VisitorStatsCard } from "../components/home/VisitorStatsCard";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

const documentKeywords = ["เอกสาร", "document", "ita", "แผนงาน", "ประกันคุณภาพ"];

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
