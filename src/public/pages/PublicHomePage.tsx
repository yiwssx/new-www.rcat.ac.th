import { lazy, ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { Box, Container, Stack } from "@mui/material";
import Grid from "@mui/material/Grid";
import { normalizeHomepageSettings } from "../../services/homepageSettings";
import { normalizeSiteSettings } from "../../services/siteSettings";
import PublicHomeCarouselSsrBoundary from "../components/PublicHomeCarouselSsrBoundary";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState, { PublicBackgroundProgress } from "../components/PublicLoadingState";
import PublicSiteShell from "../components/PublicSiteShell";
import { LatestAnnouncementsCard } from "../components/home/LatestAnnouncementsCard";
import { HomeHeroSection } from "../components/home/HomeHeroSection";
import { HomeIntroVideoSection } from "../components/home/HomeIntroVideoSection";
import { LatestNewsSection } from "../components/home/LatestNewsSection";
import { VisitorStatsCard } from "../components/home/VisitorStatsCard";
import { useLiveVisitorStats } from "../hooks/useLiveVisitorStats";
import { usePublicHomeSnapshot } from "../hooks/usePublicHomeSnapshot";

const LazyAchievementHighlightsSection = lazy(() =>
  import("../components/home/AchievementHighlightsSection").then((module) => ({
    default: module.AchievementHighlightsSection
  }))
);
const LazyContactMapCard = lazy(() =>
  import("../components/home/ContactMapCard").then((module) => ({
    default: module.ContactMapCard
  }))
);
const LazyDocumentListCard = lazy(() =>
  import("../../features/public-documents/DocumentListCard").then((module) => ({
    default: module.DocumentListCard
  }))
);
const LazyEventListCard = lazy(() =>
  import("../components/home/EventListCard").then((module) => ({
    default: module.EventListCard
  }))
);
const LazyExternalServicesSection = lazy(() =>
  import("../components/home/ExternalServicesSection").then((module) => ({
    default: module.ExternalServicesSection
  }))
);
const LazyJobOpportunitiesSection = lazy(() =>
  import("../components/home/JobOpportunitiesSection").then((module) => ({
    default: module.JobOpportunitiesSection
  }))
);
const LazyProcurementNewsSection = lazy(() =>
  import("../components/home/ProcurementNewsSection").then((module) => ({
    default: module.ProcurementNewsSection
  }))
);
const LazyProgramsSection = lazy(() =>
  import("../components/home/ProgramsSection").then((module) => ({
    default: module.ProgramsSection
  }))
);

declare global {
  interface Window {
    __RCAT_ENABLE_HOME_DEFER_TEST__?: boolean;
  }
}

function getSnapshotReferenceTimeMs(generatedAt: string) {
  const parsed = Date.parse(generatedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldUseHomeDeferTestHarness() {
  return (
    import.meta.env.MODE === "test" &&
    typeof window !== "undefined" &&
    window.__RCAT_ENABLE_HOME_DEFER_TEST__ === true &&
    typeof window.IntersectionObserver !== "undefined"
  );
}

function DeferredHomeSection({
  children,
  minHeight = 180
}: {
  children: ReactNode;
  minHeight?: number | { xs?: number; sm?: number; md?: number; lg?: number };
}) {
  const useTestHarness = shouldUseHomeDeferTestHarness();
  const [testHarnessActivated, setTestHarnessActivated] = useState(() => !useTestHarness);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!useTestHarness || testHarnessActivated) {
      return undefined;
    }

    const section = sectionRef.current;
    if (!section) {
      setTestHarnessActivated(true);
      return undefined;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          setTestHarnessActivated(true);
          observer.disconnect();
        }
      },
      { rootMargin: "720px 0px" }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [testHarnessActivated, useTestHarness]);

  const shouldRender = !useTestHarness || testHarnessActivated;

  return (
    <Box
      ref={sectionRef}
      sx={{
        minHeight: shouldRender ? undefined : minHeight,
        contentVisibility: "auto",
        containIntrinsicSize: typeof minHeight === "number" ? `auto ${minHeight}px` : undefined
      }}
    >
      {shouldRender ? <Suspense fallback={<Box sx={{ minHeight }} />}>{children}</Suspense> : null}
    </Box>
  );
}

function LiveVisitorStatsCard({
  initialStats,
  initialDataUpdatedAt
}: {
  initialStats: NonNullable<ReturnType<typeof usePublicHomeSnapshot>["data"]>["visitorStats"];
  initialDataUpdatedAt: number;
}) {
  const stats = useLiveVisitorStats(initialStats, initialDataUpdatedAt);

  return <VisitorStatsCard stats={stats} />;
}

export default function PublicHomePage() {
  const { data, dataUpdatedAt, isLoading, isFetching, isError, refetch } = usePublicHomeSnapshot();

  if (!data && (isLoading || isFetching)) {
    return (
      <PublicSiteShell hidePageHeader disableMainContainer canonicalPath="/" skipShellDataFetch>
        <Container maxWidth="xl">
          <PublicLoadingState variant="home" />
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
      <PublicSiteShell hidePageHeader disableMainContainer canonicalPath="/" skipShellDataFetch>
        <Container maxWidth="xl">
          <PublicLoadingState variant="home" />
        </Container>
      </PublicSiteShell>
    );
  }

  const siteSettings = normalizeSiteSettings(data.siteSettings);
  const homepageSettings = normalizeHomepageSettings(data.homepageSettings);
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
  const hasFloatingMessenger = siteSettings.messengerEnabled && Boolean(siteSettings.messengerUrl);
  const snapshotReferenceTimeMs = getSnapshotReferenceTimeMs(data.generatedAt);

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
      <PublicBackgroundProgress active={isFetching} />
      <PublicHomeCarouselSsrBoundary
        slides={carouselSlides}
        settings={homepageSettings.carousel}
        initialNowMs={snapshotReferenceTimeMs}
      />
      <Container maxWidth="xl" sx={{ pb: hasFloatingMessenger ? { xs: 9, md: 14 } : undefined }}>
        <HomeHeroSection siteSettings={siteSettings} />
        <HomeIntroVideoSection settings={homepageSettings.introVideo} />

        <Box component="section" id="news" sx={{ mt: { xs: 3, md: 4 } }}>
          <Grid
            container
            spacing={3.2}
            sx={{
              alignItems: "flex-start"
            }}
          >
            <Grid size={{ xs: 12, lg: 8 }} sx={{ order: { xs: 1, lg: 1 } }}>
              <LatestNewsSection items={latestNews} mediaAssets={mediaAssets} />

              <DeferredHomeSection minHeight={{ xs: 180, md: 210 }}>
                <LazyProcurementNewsSection items={procurementItems} />
              </DeferredHomeSection>
              <DeferredHomeSection minHeight={{ xs: 180, md: 210 }}>
                <LazyJobOpportunitiesSection items={jobOpportunityItems} />
              </DeferredHomeSection>
              <DeferredHomeSection minHeight={{ xs: 360, md: 420 }}>
                <LazyProgramsSection items={programItems} mediaAssets={mediaAssets} />
              </DeferredHomeSection>
              <DeferredHomeSection minHeight={{ xs: 220, md: 260 }}>
                <LazyAchievementHighlightsSection
                  items={achievementItems}
                  limit={6}
                  viewAllHref="/achievements"
                  viewAllLabel="ดูผลงานทั้งหมด"
                />
              </DeferredHomeSection>
              <DeferredHomeSection minHeight={{ xs: 240, md: 280 }}>
                <Box sx={{ display: { xs: "none", lg: "block" } }}>
                  <LazyExternalServicesSection items={externalServiceItems} mediaAssets={mediaAssets} />
                </Box>
              </DeferredHomeSection>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }} sx={{ order: { xs: 2, lg: 2 } }}>
              <Stack spacing={2.5}>
                <LatestAnnouncementsCard items={latestAnnouncements} />
                <DeferredHomeSection minHeight={220}>
                  <LazyEventListCard
                    items={eventItems}
                    mediaAssets={mediaAssets}
                    limit={3}
                    viewAllHref="/calendar"
                    viewAllLabel="ดูกำหนดการทั้งหมด"
                    initialNowMs={snapshotReferenceTimeMs}
                  />
                </DeferredHomeSection>
                <DeferredHomeSection minHeight={220}>
                  <LazyDocumentListCard
                    items={documentItems}
                    limit={3}
                    viewAllHref="/documents"
                    viewAllLabel="ดูเอกสารทั้งหมด"
                  />
                </DeferredHomeSection>
                <DeferredHomeSection minHeight={260}>
                  <Box sx={{ display: { xs: "block", lg: "none" } }}>
                    <LazyExternalServicesSection items={externalServiceItems} mediaAssets={mediaAssets} />
                  </Box>
                </DeferredHomeSection>
                <DeferredHomeSection minHeight={320}>
                  <LazyContactMapCard siteSettings={siteSettings} />
                </DeferredHomeSection>
                <LiveVisitorStatsCard initialStats={data.visitorStats} initialDataUpdatedAt={dataUpdatedAt} />
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </PublicSiteShell>
  );
}
