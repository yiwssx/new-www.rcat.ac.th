import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_SETTINGS, normalizeHomepageSettings } from "../services/homepageSettings";

describe("homepageSettings", () => {
  it("returns disabled defaults when input is undefined", () => {
    expect(normalizeHomepageSettings()).toEqual(DEFAULT_HOMEPAGE_SETTINGS);
    expect(DEFAULT_HOMEPAGE_SETTINGS.introGate.imageAlt).toBe("ภาพแนะนำ");
    expect(DEFAULT_HOMEPAGE_SETTINGS.marquee.speedSeconds).toBe(60);
  });

  it("preserves valid values", () => {
    const settings = normalizeHomepageSettings({
      carousel: {
        autoplayEnabled: false,
        autoplayIntervalSeconds: 8,
        showArrows: false,
        showDots: false,
        pauseOnHover: false,
        pauseOnFocus: false,
        transition: "fade"
      },
      introGate: {
        enabled: true,
        imageUrl: "https://example.edu/intro.jpg",
        imageAlt: "Intro image",
        primaryButtonLabel: "Enter",
        secondaryButtonLabel: "Details",
        secondaryButtonUrl: "https://example.edu/details",
        storageKey: "custom-intro"
      },
      marquee: {
        enabled: true,
        label: "Notice",
        text: "School announcement",
        speedSeconds: 48
      },
      introVideo: {
        enabled: true,
        title: "Campus video",
        youtubeEmbedUrl: "https://www.youtube-nocookie.com/embed/example"
      }
    });

    expect(settings.carousel.autoplayEnabled).toBe(false);
    expect(settings.carousel.autoplayIntervalSeconds).toBe(8);
    expect(settings.carousel.showArrows).toBe(false);
    expect(settings.carousel.showDots).toBe(false);
    expect(settings.carousel.pauseOnHover).toBe(false);
    expect(settings.carousel.pauseOnFocus).toBe(false);
    expect(settings.carousel.transition).toBe("fade");
    expect(settings.introGate.enabled).toBe(true);
    expect(settings.introGate.imageUrl).toBe("https://example.edu/intro.jpg");
    expect(settings.marquee.text).toBe("School announcement");
    expect(settings.marquee.speedSeconds).toBe(48);
    expect(settings.introVideo.youtubeEmbedUrl).toBe("https://www.youtube-nocookie.com/embed/example");
  });

  it("clamps marquee speedSeconds", () => {
    expect(
      normalizeHomepageSettings({
        marquee: {
          enabled: true,
          label: "Notice",
          text: "Fast",
          speedSeconds: 4
        }
      }).marquee.speedSeconds
    ).toBe(24);

    expect(
      normalizeHomepageSettings({
        marquee: {
          enabled: true,
          label: "Notice",
          text: "Slow",
          speedSeconds: 120
        }
      }).marquee.speedSeconds
    ).toBe(120);

    expect(
      normalizeHomepageSettings({
        marquee: {
          enabled: true,
          label: "Notice",
          text: "Very slow",
          speedSeconds: 240
        }
      }).marquee.speedSeconds
    ).toBe(180);
  });

  it("clamps carousel autoplay interval seconds", () => {
    expect(
      normalizeHomepageSettings({
        carousel: {
          autoplayEnabled: true,
          autoplayIntervalSeconds: 1
        }
      }).carousel.autoplayIntervalSeconds
    ).toBe(3);

    expect(
      normalizeHomepageSettings({
        carousel: {
          autoplayEnabled: true,
          autoplayIntervalSeconds: 60
        }
      }).carousel.autoplayIntervalSeconds
    ).toBe(30);
  });
});

it("deep-normalizes old carousel settings and preserves boolean false", () => {
  const settings = normalizeHomepageSettings({
    carousel: {
      autoplayEnabled: false,
      autoplayIntervalSeconds: 8
    }
  });

  expect(settings.carousel).toEqual({
    autoplayEnabled: false,
    autoplayIntervalSeconds: 8,
    showArrows: true,
    showDots: true,
    pauseOnHover: true,
    pauseOnFocus: true,
    transition: "slide"
  });
});

it("normalizes invalid transition and supports partial nested carousel updates", () => {
  const current = normalizeHomepageSettings({
    carousel: {
      autoplayEnabled: false,
      autoplayIntervalSeconds: 8,
      showArrows: false,
      showDots: true,
      pauseOnHover: false,
      pauseOnFocus: false,
      transition: "fade"
    }
  });
  const settings = normalizeHomepageSettings({
    ...current,
    carousel: {
      ...current.carousel,
      showDots: false,
      transition: "wipe" as never
    }
  });

  expect(settings.carousel).toEqual({
    autoplayEnabled: false,
    autoplayIntervalSeconds: 8,
    showArrows: false,
    showDots: false,
    pauseOnHover: false,
    pauseOnFocus: false,
    transition: "slide"
  });
});
