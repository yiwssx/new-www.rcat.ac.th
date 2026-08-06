import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PublicLoadingState, { PublicBackgroundProgress } from "../public/components/PublicLoadingState";
import PublicFooterDirectory from "../public/components/PublicFooterDirectory";
import { getEnabledFooterDirectoryGroups } from "../public/components/publicFooterDirectoryPolicy";
import publicShellRouteLayoutSource from "../public/components/PublicShellRouteLayout.tsx?raw";
import publicSiteShellSource from "../public/components/PublicSiteShell.tsx?raw";

const footerGroups = [
  {
    title: "หน่วยงานทดสอบ",
    links: [
      { label: "ลิงก์ที่เปิดใช้งาน", href: "/enabled", enabled: true },
      { label: "ลิงก์ที่ปิดใช้งาน", href: "/disabled", enabled: false },
      { label: "ลิงก์ไม่ปลอดภัย", href: "javascript:alert(1)", enabled: true }
    ]
  },
  {
    title: "กลุ่มว่าง",
    links: [{ label: "ไม่มีปลายทาง", href: "#", enabled: true }]
  }
];

afterEach(cleanup);

describe("Public Footer Directory stability", () => {
  it("renders the ready state with stable region metadata and unchanged safe-link filtering", () => {
    render(<PublicFooterDirectory groups={footerGroups} />);

    const directory = screen.getByRole("region", {
      name: "ไดเรกทอรีลิงก์ส่วนท้ายเว็บไซต์"
    });
    expect(directory).toHaveAttribute("data-cls-region", "footer-directory");
    expect(directory).toHaveAttribute("data-footer-directory-state", "ready");
    expect(directory).toHaveAttribute("data-footer-directory-columns", "responsive-1-2-4");
    expect(within(directory).getByRole("link", { name: "เปิดลิงก์ ลิงก์ที่เปิดใช้งาน" })).toHaveAttribute(
      "href",
      "/enabled"
    );
    expect(within(directory).queryByText("ลิงก์ที่ปิดใช้งาน")).not.toBeInTheDocument();
    expect(within(directory).queryByText("ลิงก์ไม่ปลอดภัย")).not.toBeInTheDocument();
    expect(within(directory).queryByText("กลุ่มว่าง")).not.toBeInTheDocument();
  });

  it("renders a responsive non-focusable loading placeholder with the same outer contract", () => {
    const { container } = render(<PublicFooterDirectory groups={[]} pending />);
    const directory = container.querySelector('[data-cls-region="footer-directory"]');

    expect(directory).toHaveAttribute("data-footer-directory-state", "loading");
    expect(directory).toHaveAttribute("data-footer-directory-columns", "responsive-1-2-4");
    expect(directory).toHaveAttribute("aria-hidden", "true");
    expect(directory?.querySelectorAll("a, button, input, select, textarea, [tabindex]").length).toBe(0);
    expect(directory?.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(20);
  });

  it("keeps a resolved-empty marker without permanent geometry", () => {
    const { container } = render(<PublicFooterDirectory groups={[]} />);
    const directory = container.querySelector('[data-footer-directory-state="empty"]');

    expect(directory).toHaveAttribute("data-cls-region", "footer-directory");
    expect(directory).toHaveAttribute("hidden");
    expect(directory).not.toBeVisible();
  });

  it("keeps the directory normalizer deterministic", () => {
    expect(getEnabledFooterDirectoryGroups(footerGroups)).toEqual([
      {
        title: "หน่วยงานทดสอบ",
        links: [{ label: "ลิงก์ที่เปิดใช้งาน", href: "/enabled", enabled: true }]
      }
    ]);
  });
});

describe("Public route loading geometry", () => {
  for (const variant of ["listing", "card-grid", "search-results", "content-detail", "home", "simple"] as const) {
    it(`renders the ${variant} structured loading variant`, () => {
      render(<PublicLoadingState variant={variant} />);

      const loading = screen.getByRole("status", { name: "Preparing page" });
      expect(loading).toHaveAttribute("data-cls-region", "public-loading");
      expect(loading).toHaveAttribute("data-public-loading-variant", variant);
      expect(loading.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
      expect(loading.querySelectorAll("a, button, input, select, textarea, [tabindex]").length).toBe(0);
    });
  }

  it("keeps a constant background-progress slot while ready content refetches", () => {
    const { container, rerender } = render(<PublicBackgroundProgress active={false} />);
    const progressSlot = container.querySelector('[data-cls-region="background-progress"]');

    expect(progressSlot).toBeInTheDocument();
    expect(within(progressSlot as HTMLElement).queryByRole("progressbar")).not.toBeInTheDocument();

    rerender(<PublicBackgroundProgress active />);

    expect(container.querySelector('[data-cls-region="background-progress"]')).toBe(progressSlot);
    expect(within(progressSlot as HTMLElement).getByRole("progressbar")).toBeInTheDocument();
  });

  it("owns the Public shell once at the persistent route layout", () => {
    expect(publicShellRouteLayoutSource).toContain("<PublicSiteShell routeLayout");
    expect(publicShellRouteLayoutSource).toContain("routePathname={pathname}");
    expect(publicShellRouteLayoutSource).toContain("<Outlet />");
    expect(publicSiteShellSource).toContain("PublicSiteShellRegistrationContext.Provider");
    expect(publicSiteShellSource).toContain("RegisteredPublicSiteShell");
    expect(publicSiteShellSource).toContain("return <>{children}</>;");
    expect(publicSiteShellSource).not.toContain("activeRegistration === registration");
    // Intro Gate is intentionally scoped to the homepage and must never activate on /news or other public routes.
    expect(publicSiteShellSource).toContain('pathname === "/" &&');
    expect(publicSiteShellSource).not.toContain("useLayoutEffect");
  });
});
