import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SocialBrandIcon, {
  SOCIAL_BRAND_ICON_SIZE,
  SOCIAL_BRAND_ICON_SOURCE,
  type SocialPlatform
} from "../design-system/icons/SocialBrandIcon";
import SocialIconLink, { SOCIAL_ICON_LINK_SIZE } from "../public/components/SocialIconLink";

const platforms: SocialPlatform[] = ["facebook", "youtube", "tiktok"];

describe("Social brand icon policy", () => {
  it("uses one normalized source, viewBox, and size for every social brand", () => {
    render(
      <>
        {platforms.map((platform) => (
          <SocialBrandIcon key={platform} platform={platform} data-testid={`brand-${platform}`} />
        ))}
      </>
    );

    for (const platform of platforms) {
      const icon = screen.getByTestId(`brand-${platform}`);

      expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
      expect(icon).toHaveAttribute("data-social-brand-icon", platform);
      expect(icon).toHaveAttribute("data-social-brand-icon-size", String(SOCIAL_BRAND_ICON_SIZE));
      expect(icon).toHaveAttribute("data-social-brand-icon-source", "simple-icons-16.21.0");
      expect(icon.querySelector("path")).not.toBeNull();
    }

    expect(SOCIAL_BRAND_ICON_SOURCE).toBe("Simple Icons 16.21.0");
  });

  it("uses the canonical MUI IconButton contract without a permanent circle decoration", () => {
    render(<SocialIconLink platform="tiktok" href="https://www.tiktok.com/@rcat" label="TikTok" />);

    const link = screen.getByRole("link", { name: "TikTok" });
    const icon = link.querySelector('[data-social-brand-icon="tiktok"]');

    expect(link).toHaveAttribute("data-social-icon-decoration", "none");
    expect(link).toHaveAttribute("data-social-icon-link", "tiktok");
    expect(link).toHaveAttribute("data-social-icon-control", "mui-icon-button");
    expect(link).toHaveClass("MuiIconButton-root");
    expect(link).toHaveClass("MuiIconButton-colorInherit");
    expect(icon).toHaveAttribute("data-social-brand-icon-size", String(SOCIAL_BRAND_ICON_SIZE));
    expect(SOCIAL_ICON_LINK_SIZE).toBe(40);
  });
});
