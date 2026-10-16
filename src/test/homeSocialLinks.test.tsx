import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomeSocialLinksCard from "../public/components/home/HomeSocialLinksCard";
import { buildFacebookPagePluginUrl } from "../public/utils/facebookPagePlugin";
import {
  DEFAULT_SOCIAL_WIDGET,
  normalizeHomepageSocialWidget,
  socialFacebookPageUrl,
  socialHttpsUrl,
  validateHomepageSocialDraft
} from "../features/cms-settings/socialWidget";

const settings = {
  ...DEFAULT_SOCIAL_WIDGET,
  enabled: true,
  links: [
    {
      id: "dept1",
      category: "department" as const,
      label: "แผนกวิชาคอมพิวเตอร์",
      href: "https://www.facebook.com/department1",
      iconKey: "computer" as const,
      iconUrl: "",
      enabled: true
    },
    {
      id: "unit1",
      category: "unit" as const,
      label: "งานประชาสัมพันธ์",
      href: "https://www.facebook.com/office1",
      iconKey: "custom" as const,
      iconUrl: "https://drive.google.com/thumbnail?id=abc&sz=w256",
      enabled: true
    },
    {
      id: "hidden",
      category: "department" as const,
      label: "ปิดการแสดงผล",
      href: "https://www.facebook.com/hidden",
      iconKey: "facebook" as const,
      iconUrl: "",
      enabled: false
    }
  ]
};

describe("homepage social widget model", () => {
  it("does not expose a new widget before an operator enables it", () => {
    expect(normalizeHomepageSocialWidget(undefined)).toEqual(DEFAULT_SOCIAL_WIDGET);
    expect(render(<HomeSocialLinksCard pageUrl="https://www.facebook.com/rcat" />).container.firstChild).toBeNull();
  });

  it("only builds an embed for an HTTPS Facebook Page", () => {
    expect(socialFacebookPageUrl("https://www.facebook.com/rcat")).toBe("https://www.facebook.com/rcat");
    expect(socialFacebookPageUrl("https://evil.example/rcat")).toBe("");
    expect(socialFacebookPageUrl("https://www.facebook.com.evil.example/rcat")).toBe("");
    expect(socialFacebookPageUrl("https://www.facebook.com/")).toBe("");
    expect(socialHttpsUrl("javascript:alert(1)")).toBe("");
    expect(socialHttpsUrl("https://user:password@example.org/")).toBe("");
    const plugin = new URL(buildFacebookPagePluginUrl("https://www.facebook.com/rcat", 610, 520));
    expect(plugin.hostname).toBe("www.facebook.com");
    expect(plugin.pathname).toBe("/plugins/page.php");
    expect(plugin.searchParams.get("width")).toBe("500");
    expect(plugin.searchParams.get("height")).toBe("520");
    expect(plugin.searchParams.get("tabs")).toBe("timeline");
    expect(buildFacebookPagePluginUrl("https://evil.example/", 320, 520)).toBe("");
  });

  it("renders one page plugin and links with distinct groups and custom logos", () => {
    // jsdom has no layout, so simulate a measured sidebar width before the sizing effect runs.
    const measurement = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 360
    } as DOMRect);
    const { container } = render(<HomeSocialLinksCard pageUrl="https://www.facebook.com/rcat" settings={settings} />);
    measurement.mockRestore();
    expect(container.querySelectorAll('[data-public-deferred-embed="true"]')).toHaveLength(1);
    expect(
      container.querySelector('[data-public-deferred-embed="true"]')?.getAttribute("data-public-embed-load-mode")
    ).toBe("near-viewport");
    expect(screen.getByText("Facebook แผนกวิชา")).toBeTruthy();
    expect(screen.getByText("Facebook งานและหน่วยงาน")).toBeTruthy();
    expect(screen.queryByText("ปิดการแสดงผล")).toBeNull();
    const schoolLink = screen.getByRole("link", { name: /เปิด Facebook วิทยาลัย/ });
    expect(schoolLink.getAttribute("rel")).toContain("noopener");
    const departmentLink = screen.getByRole("link", { name: /แผนกวิชาคอมพิวเตอร์/ });
    expect(departmentLink.getAttribute("target")).toBe("_blank");
    const unitLink = screen.getByRole("link", { name: /งานประชาสัมพันธ์/ });
    expect(within(unitLink).getByRole("img", { name: "งานประชาสัมพันธ์" })).toBeTruthy();
  });

  it("allows published links without requiring the Facebook Page iframe", () => {
    const { container } = render(
      <HomeSocialLinksCard pageUrl="" settings={{ ...settings, pageEmbedEnabled: false }} />
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText("งานประชาสัมพันธ์")).toBeTruthy();
  });

  it("filters malformed links and refuses invalid admin drafts", () => {
    const normalized = normalizeHomepageSocialWidget({
      enabled: true,
      pageEmbedHeight: 9999,
      links: [
        {
          id: "bad",
          category: "unit",
          label: "Bad",
          href: "javascript:alert(1)",
          iconKey: "custom",
          iconUrl: "",
          enabled: true
        }
      ]
    });
    expect(normalized.pageEmbedHeight).toBe(800);
    expect(normalized.links[0].href).toBe("");
    expect(normalized.links[0].iconKey).toBe("link");
    expect(() => validateHomepageSocialDraft(settings)).not.toThrow();
    expect(() =>
      validateHomepageSocialDraft({
        ...settings,
        links: [{ ...settings.links[0], href: "javascript:alert(1)" }]
      })
    ).toThrow("HTTPS");
    expect(() =>
      validateHomepageSocialDraft({
        ...settings,
        links: [{ ...settings.links[0], iconKey: "custom", iconUrl: "" }]
      })
    ).toThrow("อัปโหลด");
  });
});
