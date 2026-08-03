import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PublicContentCard from "../src/public/components/PublicContentCard";
import { resolvePublicImageSource } from "../src/shared/media/publicImageSources";
import {
  parsePublicImagePolicies,
  scanPublicMediaSource,
  validatePublicImagePolicies
} from "./public-media-governance.mjs";

afterEach(() => {
  cleanup();
});

describe("Public media governance parser", () => {
  it("detects raw Public image and iframe owners independent of JSX formatting", () => {
    const source = `
      export function Consumer() {
        return (
          <>
            <Box
              component={"img"}
              src={asset.previewUrl}
            />
            <iframe title="video" src={videoUrl} />
          </>
        );
      }
    `;
    const rules = scanPublicMediaSource("src/public/components/Consumer.tsx", source).map(
      (violation) => violation.rule
    );

    expect(rules).toContain("approved-image-owner");
    expect(rules).toContain("approved-iframe-owner");
    expect(rules).toContain("no-direct-preview-src");
  });

  it("allows raw rendering only in the approved low-level owners", () => {
    expect(
      scanPublicMediaSource(
        "src/shared/media/PublicResponsiveImage.tsx",
        `export const Image = () => <Box component="img" src={source.src} fetchPriority="high" />;`
      )
    ).toEqual([]);
    expect(
      scanPublicMediaSource(
        "src/shared/media/PublicDeferredEmbed.tsx",
        `export const Frame = () => <Box component="iframe" src={safeSrc} />;`
      )
    ).toEqual([]);
  });

  it("allows high priority for the deterministic Carousel boundary without widening the owner policy", () => {
    expect(
      scanPublicMediaSource(
        "src/public/components/PublicHomeCarouselSsrBoundary.tsx",
        `export const Boundary = () => <CarouselImageStage fetchPriority="high" />;`
      )
    ).toEqual([]);

    expect(
      scanPublicMediaSource(
        "src/public/components/UnapprovedCriticalOwner.tsx",
        `export const Consumer = () => <PublicResponsiveImage fetchPriority="high" />;`
      ).map((violation) => violation.rule)
    ).toContain("critical-priority-owner");
  });

  it("detects restricted imports from neutral Public media modules", () => {
    expect(
      scanPublicMediaSource(
        "src/shared/media/BadBoundary.tsx",
        `import { useCmsAuth } from "../../admin/cms-auth/useCmsAuth";`
      ).map((violation) => violation.rule)
    ).toContain("public-media-import-boundary");
  });

  it("parses and validates policy definitions", () => {
    const source = `
      export const PUBLIC_IMAGE_POLICIES = {
        "content-card": { widths: [160, 240, 640], fallbackWidth: 240 },
        "content-body": { widths: [480, 900, 1600], fallbackWidth: 900 }
      };
    `;

    expect(parsePublicImagePolicies(source)).toEqual({
      "content-card": { fallbackWidth: 240, widths: [160, 240, 640] },
      "content-body": { fallbackWidth: 900, widths: [480, 900, 1600] }
    });
    expect(validatePublicImagePolicies(parsePublicImagePolicies(source))).toEqual([]);
  });

  it("fails closed on duplicate, unsorted, invalid, and oversized small policies", () => {
    const violations = validatePublicImagePolicies({
      "content-card": {
        widths: [1600, 640, 640, 0],
        fallbackWidth: 1600
      }
    });

    expect(violations.join("\n")).toMatch(/positive integers/);
    expect(violations.join("\n")).toMatch(/unique/);
    expect(violations.join("\n")).toMatch(/sorted/);
    expect(violations.join("\n")).toMatch(/below 640/);
    expect(violations.join("\n")).toMatch(/fallback must be below 1600/);
  });

  it("keeps PublicContentCard fixed slots connected to fill-height responsive wrappers", () => {
    const item = {
      id: "governance-card",
      title: "Governance card",
      slug: "governance-card",
      type: "news",
      status: "published",
      owner: "Governance",
      summary: "Geometry contract",
      category: "Test",
      tags: [],
      featuredMediaId: "governance-image",
      updatedAt: "2026-07-28T00:00:00.000Z",
      publishAt: "2026-07-28T00:00:00.000Z"
    };
    const mediaAssets = [
      {
        id: "governance-image",
        name: "Governance image",
        type: "image",
        size: "fixture",
        owner: "Governance",
        previewUrl: "https://images.example.edu/governance.jpg",
        updatedAt: "2026-07-28T00:00:00.000Z"
      }
    ];
    const { container, rerender } = render(React.createElement(PublicContentCard, { item, mediaAssets }));

    let slot = container.querySelector('[data-public-content-card-media-slot="regular"]');
    let responsiveWrapper = slot.querySelector('[data-public-responsive-image="true"]');

    expect(slot).toHaveStyle({ width: "70px", height: "70px" });
    expect(responsiveWrapper).toHaveStyle({ width: "100%", height: "100%" });

    rerender(React.createElement(PublicContentCard, { item, mediaAssets, featured: true }));

    slot = container.querySelector('[data-public-content-card-media-slot="featured"]');
    responsiveWrapper = slot.querySelector('[data-public-responsive-image="true"]');

    expect(slot).toHaveStyle({ height: "150px" });
    expect(responsiveWrapper).toHaveStyle({ width: "100%", height: "100%" });
  });

  it("keeps MediaAsset precedence on the first usable source", () => {
    const result = resolvePublicImageSource(
      {
        type: "image",
        thumbnailUrl: "https://drive.google.com/file/d/invalid$id/view",
        previewUrl: "https://drive.google.com/file/d/governance-preview/view",
        driveUrl: "https://drive.google.com/file/d/governance-drive/view"
      },
      "content-card"
    );

    expect(result.fileId).toBe("governance-preview");
    expect(result.src).toContain("id=governance-preview");
  });
});
