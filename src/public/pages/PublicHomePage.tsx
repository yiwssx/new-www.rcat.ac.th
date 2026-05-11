import { useMemo } from "react";
import { Box, Container, LinearProgress, Stack } from "@mui/material";
import Grid from "@mui/material/Grid2";
import dayjs from "dayjs";
import { normalizeHomepageSettings } from "../../services/homepageSettings";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { normalizeVisitorStats } from "../../services/visitorStats";
import { CalendarEvent, ContentItem } from "../../types";
import PublicHomeCarousel from "../components/PublicHomeCarousel";
import PublicSiteShell from "../components/PublicSiteShell";
import { AchievementHighlightsSection } from "../components/home/AchievementHighlightsSection";
import { ContactMapCard } from "../components/home/ContactMapCard";
import { DocumentListCard } from "../components/home/DocumentListCard";
import { EventListCard } from "../components/home/EventListCard";
import { LatestAnnouncementsCard } from "../components/home/LatestAnnouncementsCard";
import { HomeHeroSection } from "../components/home/HomeHeroSection";
import { HomeIntroVideoSection } from "../components/home/HomeIntroVideoSection";
import { JobOpportunitiesSection } from "../components/home/JobOpportunitiesSection";
import { LatestNewsSection } from "../components/home/LatestNewsSection";
import { ProgramsSection } from "../components/home/ProgramsSection";
import { ProcurementNewsSection } from "../components/home/ProcurementNewsSection";
import { ExternalServicesSection } from "../components/home/ExternalServicesSection";
import { UrgentMarqueeSection } from "../components/home/UrgentMarqueeSection";
import { VisitorStatsCard } from "../components/home/VisitorStatsCard";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

const documentKeywords = ["เอกสาร", "document", "ita", "แผนงาน", "ประกันคุณภาพ"];
const procurementKeywords = ["procurement", "จัดซื้อ", "จัดจ้าง", "จัดซื้อจัดจ้าง", "ประกวดราคา", "tor"];
const jobOpportunityKeywords = [
  "job",
  "jobs",
  "recruitment",
  "สมัครงาน",
  "หางาน",
  "ตำแหน่งงาน",
  "ฝึกงาน",
  "แนะแนวอาชีพ"
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

function hasContentSearchTerm(item: ContentItem, terms: string[]) {
  const haystack = [item.title, item.summary, item.category, ...(item.tags ?? [])].join(" ").toLowerCase();

  return terms.some((term) => haystack.includes(term.toLowerCase()));
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
  const carouselSlides = data?.carouselSlides ?? [];
  const externalServiceItems = data?.externalServices ?? [];
  const procurementItems = announcementContent
    .filter((item) => hasContentSearchTerm(item, procurementKeywords))
    .slice(0, 4);
  const jobOpportunityItems = announcementContent
    .filter((item) => hasContentSearchTerm(item, jobOpportunityKeywords))
    .slice(0, 4);
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
  const homepageSettings = normalizeHomepageSettings(data.homepageSettings);
  const visitorStats = normalizeVisitorStats(data.visitorStats);

  return (
    <PublicSiteShell
      hidePageHeader
      disableMainContainer
      seoDescription={siteSettings.heroDescription || siteSettings.intro}
      canonicalPath="/"
    >
      {isFetching && <LinearProgress />}
      <UrgentMarqueeSection settings={homepageSettings.marquee} />
      <PublicHomeCarousel slides={carouselSlides} />
      <Container maxWidth="xl">
        <HomeHeroSection siteSettings={siteSettings} />
        <HomeIntroVideoSection settings={homepageSettings.introVideo} />

        <Box component="section" id="news" sx={{ mt: { xs: 3, md: 4 } }}>
          <Grid container spacing={3.2} alignItems="flex-start">
            <Grid size={{ xs: 12, lg: 8 }} sx={{ order: { xs: 1, lg: 1 } }}>
              <LatestNewsSection items={latestNews} mediaAssets={data?.media ?? []} />

              <ProcurementNewsSection items={procurementItems} />
              <JobOpportunitiesSection items={jobOpportunityItems} />
              <ProgramsSection items={programItems} mediaAssets={data?.media ?? []} />
              <AchievementHighlightsSection />
              <Box sx={{ display: { xs: "none", lg: "block" } }}>
                <ExternalServicesSection items={externalServiceItems} />
              </Box>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }} sx={{ order: { xs: 2, lg: 2 } }}>
              <Stack spacing={2.5}>
                <LatestAnnouncementsCard items={latestAnnouncements} />
                <EventListCard items={eventItems} />
                <DocumentListCard items={documentItems} />
                <Box sx={{ display: { xs: "block", lg: "none" } }}>
                  <ExternalServicesSection items={externalServiceItems} />
                </Box>
                <ContactMapCard siteSettings={siteSettings} />
                <VisitorStatsCard stats={visitorStats} />
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </PublicSiteShell>
  );
}
