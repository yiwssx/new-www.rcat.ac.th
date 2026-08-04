import { describe, expect, it } from "vitest";
import publicHomePageSource from "../public/pages/PublicHomePage.tsx?raw";
import publicCarouselBoundarySource from "../public/components/PublicHomeCarouselSsrBoundary.tsx?raw";
import publicResponsiveImageSource from "../shared/media/PublicResponsiveImage.tsx?raw";
import publicIntroGateStateSource from "../public/components/publicIntroGateState.ts?raw";
import publicIntroGateSource from "../public/components/PublicIntroGate.tsx?raw";
import eventListCardSource from "../public/components/home/EventListCard.tsx?raw";
import publicCalendarPageSource from "../public/pages/PublicCalendarPage.tsx?raw";
import liveVisitorStatsSource from "../public/hooks/useLiveVisitorStats.ts?raw";

describe("Public SSR determinism readiness", () => {
  it("keeps semantic Home sections in the production first render", () => {
    expect(publicHomePageSource).toContain('import.meta.env.MODE === "test"');
    expect(publicHomePageSource).toContain("const shouldRender = !useTestHarness || testHarnessActivated;");
    expect(publicHomePageSource).toContain("<Suspense fallback={<Box sx={{ minHeight }} />}>{children}</Suspense>");
    expect(publicHomePageSource).toContain("PublicHomeCarouselSsrBoundary");
    expect(publicHomePageSource).toContain("initialNowMs={snapshotReferenceTimeMs}");
    expect(publicHomePageSource).not.toContain("shouldDeferHomeSection");
  });

  it("renders semantic near-viewport images without an IntersectionObserver activation gate", () => {
    expect(publicResponsiveImageSource).not.toContain("useNearViewportActivation");
    expect(publicResponsiveImageSource).toContain("const shouldRenderImage = allowed && hasUsableSource;");
    expect(publicResponsiveImageSource).toContain('const loading = isNearViewportMode ? "lazy" : "eager";');
    expect(publicResponsiveImageSource).toContain('isNearViewportMode ? "low" : "auto"');
  });

  it("keeps Intro Gate first-pass visibility pure and reconciles session state after mount", () => {
    const initialVisibilityFunction = publicIntroGateStateSource.match(
      /export function getInitialPublicIntroGateVisibility[\s\S]*?\n}\n/
    )?.[0];

    expect(initialVisibilityFunction).toContain("return shouldShowPublicIntroGate(settings);");
    expect(initialVisibilityFunction).not.toContain("window");
    expect(initialVisibilityFunction).not.toContain("sessionStorage");
    expect(publicIntroGateStateSource).toContain("isPublicIntroGateDismissedInSession");
    expect(publicIntroGateSource).toContain("useEffect(() => {");
    expect(publicIntroGateSource).toContain("isPublicIntroGateDismissedInSession(settings)");
  });

  it("uses snapshot time for lifecycle-sensitive first renders", () => {
    expect(eventListCardSource).toContain("useState(() => normalizeInitialNowMs(initialNowMs))");
    expect(eventListCardSource).not.toContain("useState(() => Date.now())");
    expect(eventListCardSource).toContain("setNowMs(Date.now());");
    expect(publicCalendarPageSource).toContain("getSnapshotReferenceTimeMs(data.generatedAt)");
    expect(publicCalendarPageSource).toContain("initialNowMs={snapshotReferenceTimeMs}");
  });

  it("uses a static carousel first pass and enhances it only after mount", () => {
    expect(publicCarouselBoundarySource).toContain("const [enhanced, setEnhanced] = useState(false);");
    expect(publicCarouselBoundarySource).toContain("useEffect(() => {");
    expect(publicCarouselBoundarySource).toContain("setEnhanced(true);");
    expect(publicCarouselBoundarySource).toContain("<CarouselImageStage");
    expect(publicCarouselBoundarySource).toContain("if (enhanced) {");
    expect(publicCarouselBoundarySource).toContain("<PublicHomeCarousel slides={slides} settings={settings} />");
  });

  it("keeps live visitor polling outside server rendering", () => {
    expect(liveVisitorStatsSource).toContain('const isBrowser = typeof window !== "undefined";');
    expect(liveVisitorStatsSource).toContain(
      "const liveEnabled = isBrowser && usesCloudflare && Boolean(initialStats?.enabled);"
    );
    expect(liveVisitorStatsSource).toContain("enabled: liveEnabled");
  });
});
