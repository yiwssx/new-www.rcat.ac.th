import { describe, expect, it } from "vitest";
import {
  parsePublicImagePolicies,
  scanPublicMediaSource,
  validatePublicImagePolicies
} from "./public-media-governance.mjs";

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
});
