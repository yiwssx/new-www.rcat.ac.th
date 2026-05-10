import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_SETTINGS, normalizeHomepageSettings } from "../services/homepageSettings";

describe("homepageSettings", () => {
  it("returns disabled defaults when input is undefined", () => {
    expect(normalizeHomepageSettings()).toEqual(DEFAULT_HOMEPAGE_SETTINGS);
  });

  it("preserves valid values", () => {
    const settings = normalizeHomepageSettings({
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
    ).toBe(12);

    expect(
      normalizeHomepageSettings({
        marquee: {
          enabled: true,
          label: "Notice",
          text: "Slow",
          speedSeconds: 120
        }
      }).marquee.speedSeconds
    ).toBe(90);
  });
});
