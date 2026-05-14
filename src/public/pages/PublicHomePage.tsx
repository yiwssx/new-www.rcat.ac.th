import { Box, Container, LinearProgress, Stack } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { normalizeHomepageSettings } from "../../services/homepageSettings";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { normalizeVisitorStats } from "../../services/visitorStats";
import PublicHomeCarousel from "../components/PublicHomeCarousel";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState from "../components/PublicLoadingState";
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
import { usePublicHomeSnapshot } from "../hooks/usePublicHomeSnapshot";

export default function PublicHomePage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicHomeSnapshot();

  if (!data && (isLoading || isFetching)) {
    return (
      <PublicSiteShell hidePageHeader disableMainContainer canonicalPath="/">
        <Container maxWidth="xl">
          <PublicLoadingState />
        </Container>
      </PublicSiteShell>
    );
  }

  if (!data && isError) {
    return (
      <PublicErrorState
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isFetching}
      />
    );
  }

  if (!data) {
    return (
      <PublicSiteShell hidePageHeader disableMainContainer canonicalPath="/">
        <Container maxWidth="xl">
          <PublicLoadingState />
        </Container>
      </PublicSiteShell>
    );
  }

  const siteSettings = normalizeSiteSettings(data.siteSettings);
  const homepageSettings = normalizeHomepageSettings(data.homepageSettings);
  const visitorStats = normalizeVisitorStats(data.visitorStats);
  const latestNews = data.latestNews ?? [];
  const latestAnnouncements = data.latestAnnouncements ?? [];
  const procurementItems = data.procurementItems ?? [];
  const jobOpportunityItems = data.jobOpportunityItems ?? [];
  const achievementItems = data.achievementItems ?? [];
  const programItems = data.programItems ?? [];
  const documentItems = data.documentItems ?? [];
  const eventItems = data.eventItems ?? [];
  const mediaAssets = data.media ?? [];
  const carouselSlides = data.carouselSlides ?? [];
  const externalServiceItems = data.externalServices ?? [];

  return (
    <PublicSiteShell
      hidePageHeader
      disableMainContainer
      seoDescription={siteSettings.heroDescription || siteSettings.intro}
      canonicalPath="/"
      preloadedSiteSettings={data.siteSettings}
      preloadedHomepageSettings={data.homepageSettings}
      preloadedDisplaySettings={data.displaySettings}
      preloadedMenu={data.menu}
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
              <LatestNewsSection items={latestNews} mediaAssets={mediaAssets} />

              <ProcurementNewsSection items={procurementItems} />
              <JobOpportunitiesSection items={jobOpportunityItems} />
              <ProgramsSection items={programItems} mediaAssets={mediaAssets} />
              <AchievementHighlightsSection items={achievementItems} />
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
