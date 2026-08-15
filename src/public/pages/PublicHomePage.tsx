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
import { usePublicShellSnapshot } from "../hooks/usePublicShellSnapshot";

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

const E_SERVICE_HASH = "#e-service";
const E_SERVICE_REANCHOR_DELAYS_MS = [0, 120, 320, 700, 1400, 2600, 4200] as const;

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

export function HomeHashScroller() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let observer: MutationObserver | undefined;
    let scheduledTimeouts: number[] = [];
    let listeningForUserIntent = false;

    const findVisibleTarget = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-e-service-anchor]")).find(
        (element) => element.getClientRects().length > 0
      );

    const clearScheduledTimeouts = () => {
      scheduledTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      scheduledTimeouts = [];
    };

    const removeUserIntentListeners = () => {
      if (!listeningForUserIntent) {
        return;
      }

      window.removeEventListener("wheel", stopForUserIntent);
      window.removeEventListener("touchstart", stopForUserIntent);
      window.removeEventListener("pointerdown", stopForUserIntent);
      window.removeEventListener("keydown", stopForUserIntent);
      listeningForUserIntent = false;
    };

    const stopCurrentSession = () => {
      observer?.disconnect();
      observer = undefined;
      clearScheduledTimeouts();
      removeUserIntentListeners();
    };

    function stopForUserIntent() {
      stopCurrentSession();
    }

    const addUserIntentListeners = () => {
      if (listeningForUserIntent) {
        return;
      }

      window.addEventListener("wheel", stopForUserIntent, { passive: true });
      window.addEventListener("touchstart", stopForUserIntent, { passive: true });
      window.addEventListener("pointerdown", stopForUserIntent, { passive: true });
      window.addEventListener("keydown", stopForUserIntent);
      listeningForUserIntent = true;
    };

    const scrollToVisibleTarget = () => {
      const target = findVisibleTarget();
      if (!target) {
        return false;
      }

      target.scrollIntoView({ block: "start" });
      return true;
    };

    const scheduleReanchoring = () => {
      observer?.disconnect();
      observer = undefined;
      clearScheduledTimeouts();
      addUserIntentListeners();

      const lastDelay = E_SERVICE_REANCHOR_DELAYS_MS[E_SERVICE_REANCHOR_DELAYS_MS.length - 1];

      E_SERVICE_REANCHOR_DELAYS_MS.forEach((delay) => {
        const timeoutId = window.setTimeout(() => {
          if (window.location.hash !== E_SERVICE_HASH) {
            stopCurrentSession();
            return;
          }

          scrollToVisibleTarget();

          if (delay === lastDelay) {
            scheduledTimeouts = [];
            removeUserIntentListeners();
          }
        }, delay);

        scheduledTimeouts.push(timeoutId);
      });
    };

    const startHashSession = () => {
      stopCurrentSession();

      if (window.location.hash !== E_SERVICE_HASH) {
        return;
      }

      if (findVisibleTarget()) {
        scheduleReanchoring();
        return;
      }

      observer = new MutationObserver(() => {
        if (findVisibleTarget()) {
          scheduleReanchoring();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };

    startHashSession();
    window.addEventListener("hashchange", startHashSession);

    return () => {
      window.removeEventListener("hashchange", startHashSession);
      stopCurrentSession();
    };
  }, []);

  return null;
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
  const homeQuery = usePublicHomeSnapshot();
  const shellQuery = usePublicShellSnapshot();
  const { data, dataUpdatedAt, isFetching } = homeQuery;
  const shellData = shellQuery.data;
  const missingRequiredData = !data || !shellData;
  const loadingRequiredData =
    (!data && (homeQuery.isLoading || homeQuery.isFetching)) ||
    (!shellData && (shellQuery.isLoading || shellQuery.isFetching));
  const requiredDataError = (!data && homeQuery.isError) || (!shellData && shellQuery.isError);

  if (missingRequiredData && loadingRequiredData) {
    return (
      <PublicSiteShell hidePageHeader disableMainContainer canonicalPath="/" skipShellDataFetch>
        <Container maxWidth="xl">
          <PublicLoadingState variant="home" />
        </Container>
      </PublicSiteShell>
    );
  }

  if (missingRequiredData && requiredDataError) {
    return (
      <PublicErrorState
        onRetry={() => {
          void Promise.all([homeQuery.refetch(), shellQuery.refetch()]);
        }}
        isRetrying={homeQuery.isFetching || shellQuery.isFetching}
      />
    );
  }

  if (!data || !shellData) {
    return (
      <PublicSiteShell hidePageHeader disableMainContainer canonicalPath="/" skipShellDataFetch>
        <Container maxWidth="xl">
          <PublicLoadingState variant="home" />
        </Container>
      </PublicSiteShell>
    );
  }

  const siteSettings = normalizeSiteSettings(shellData.siteSettings);
  const homepageSettings = normalizeHomepageSettings(shellData.homepageSettings);
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
      preloadedSiteSettings={shellData.siteSettings}
      preloadedHomepageSettings={shellData.homepageSettings}
      preloadedDisplaySettings={shellData.displaySettings}
      preloadedMenu={shellData.menu}
    >
      <HomeHashScroller />
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
                <Box
                  data-e-service-anchor="true"
                  sx={{
                    display: { xs: "none", lg: "block" },
                    scrollMarginTop: { xs: 80, md: 96 }
                  }}
                >
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
                  <Box
                    data-e-service-anchor="true"
                    sx={{
                      display: { xs: "block", lg: "none" },
                      scrollMarginTop: { xs: 80, md: 96 }
                    }}
                  >
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
