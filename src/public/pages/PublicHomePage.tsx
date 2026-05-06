import { useMemo } from "react";
import { Box, Container, LinearProgress, Stack } from "@mui/material";
import Grid from "@mui/material/Grid2";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import dayjs from "dayjs";
import EmptyState from "../../shared/components/EmptyState";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { CalendarEvent, ContentItem } from "../../types";
import PublicContentCard from "../components/PublicContentCard";
import PublicHomeCarousel from "../components/PublicHomeCarousel";
import PublicSiteShell from "../components/PublicSiteShell";
import { AchievementHighlightsSection } from "../components/home/AchievementHighlightsSection";
import { ContactMapCard } from "../components/home/ContactMapCard";
import { DocumentListCard } from "../components/home/DocumentListCard";
import { EventListCard } from "../components/home/EventListCard";
import { HomeSectionHeading } from "../components/home/HomeSectionHeading";
import { LatestAnnouncementsCard } from "../components/home/LatestAnnouncementsCard";
import { HomeHeroSection } from "../components/home/HomeHeroSection";
import { LatestNewsSection } from "../components/home/LatestNewsSection";
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
        <HomeHeroSection siteSettings={siteSettings} />

        <Box component="section" id="news" sx={{ mt: { xs: 3, md: 4 } }}>
          <Grid container spacing={3.2} alignItems="flex-start">
            <Grid size={{ xs: 12, lg: 8 }} sx={{ order: { xs: 1, lg: 1 } }}>
              <LatestNewsSection items={latestNews} mediaAssets={data?.media ?? []} />

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
