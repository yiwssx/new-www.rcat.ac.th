import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicIntroGate from "../public/components/PublicIntroGate";
import { HomeIntroVideoSection } from "../public/components/home/HomeIntroVideoSection";
import { UrgentMarqueeSection } from "../public/components/home/UrgentMarqueeSection";
import { DEFAULT_HOMEPAGE_SETTINGS } from "../services/homepageSettings";

describe("homepage settings public sections", () => {
  it("does not render IntroGate when disabled or imageUrl is empty", () => {
    expect(render(<PublicIntroGate settings={DEFAULT_HOMEPAGE_SETTINGS.introGate} />).container.firstChild).toBeNull();

    expect(
      render(
        <PublicIntroGate
          settings={{
            ...DEFAULT_HOMEPAGE_SETTINGS.introGate,
            enabled: true
          }}
        />
      ).container.firstChild
    ).toBeNull();
  });

  it("does not render UrgentMarqueeSection when disabled or text is empty", () => {
    expect(
      render(<UrgentMarqueeSection settings={DEFAULT_HOMEPAGE_SETTINGS.marquee} />).container.firstChild
    ).toBeNull();

    expect(
      render(
        <UrgentMarqueeSection
          settings={{
            ...DEFAULT_HOMEPAGE_SETTINGS.marquee,
            enabled: true
          }}
        />
      ).container.firstChild
    ).toBeNull();
  });

  it("does not render HomeIntroVideoSection when disabled or youtubeEmbedUrl is empty", () => {
    expect(
      render(<HomeIntroVideoSection settings={DEFAULT_HOMEPAGE_SETTINGS.introVideo} />).container.firstChild
    ).toBeNull();

    expect(
      render(
        <HomeIntroVideoSection
          settings={{
            ...DEFAULT_HOMEPAGE_SETTINGS.introVideo,
            enabled: true
          }}
        />
      ).container.firstChild
    ).toBeNull();
  });
});
