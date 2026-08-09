import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicIta2569Page from "./PublicIta2569Page";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn()
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => routerMocks.navigate
}));

vi.mock("../components/PublicSiteShell", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

const EXPECTED_LINKS = {
  O1: "https://www.rcat.ac.th/rcat-organization",
  O2: "https://www.rcat.ac.th/rcat-director",
  O3: "https://www.rcat.ac.th/development-plan",
  O4: "https://www.rcat.ac.th/contact",
  O5: "https://drive.google.com/open?id=1tTaQEtfDpLbucjtkzxnNmtZfSCdcgxQX&usp=drive_fs",
  O6: "https://www.rcat.ac.th/action-plan",
  O7: "https://drive.google.com/open?id=1uXOZ0BHbIAb_YLNEMCuNUOTqN82AXs7c&usp=drive_fs",
  O8: "https://www.rcat.ac.th/sar",
  O9: "https://www.rcat.ac.th/news",
  O10: "https://drive.google.com/open?id=1GyJinLTWeP940I0am4dvyjc2eVaz3obW&usp=drive_fs",
  O11: "https://drive.google.com/open?id=16oGiE8AiXpD8PyTRRFK2WxVCLNFCZqvm&usp=drive_fs",
  O12: "https://drive.google.com/open?id=1YHiu7A1jW3v0RL7YVsFUZNQtaLxS4HFm&usp=drive_fs",
  O13: "https://drive.google.com/open?id=1tBCJfsbg5Tsby9lhAZTO1apRf8zgeQA2&usp=drive_fs",
  O14: "https://www.rcat.ac.th/#e-service",
  O15: "https://drive.google.com/open?id=1Flnk1IvIqP3dlc4TAB3hxsCENI_TTj7j&usp=drive_fs",
  O16: "https://drive.google.com/open?id=1GCmOmnlIOY4gHU2cF7rW5l8YqhDEpUZn&usp=drive_fs",
  O17: "https://drive.google.com/open?id=1D1v0DuRxGkB4EvwVbT-hAGp1htstxbf-&usp=drive_fs",
  O18: "https://drive.google.com/open?id=1sJPjuI47Bt9uq5MK_VUZS3ILP5lVF6rd&usp=drive_fs",
  O19: "https://drive.google.com/open?id=1yZ47N9xrEFvFqBPE2SSZcwHI4f3kdQCM&usp=drive_fs",
  O20: "https://drive.google.com/open?id=1W9AgBcPHVGwO3Gz9iXfsjOnvCIeEE1Mx&usp=drive_fs",
  O21: "https://drive.google.com/open?id=1q5iOCxUCENzcJ7GTJbbN7ADaxKR9y4DX&usp=drive_fs",
  O22: "https://drive.google.com/open?id=1CKf4ZsU1QvaUh0SBTvbHQuKWm-6w_7cc&usp=drive_fs",
  O23: "https://drive.google.com/open?id=19ukICUTYplRaBVqa86TtSMBSo1BieISQ&usp=drive_fs"
} as const;

const INTERNAL_NAVIGATIONS = {
  O1: { to: "/rcat-organization" },
  O2: { to: "/rcat-director" },
  O3: { to: "/development-plan" },
  O4: { to: "/contact" },
  O6: { to: "/action-plan" },
  O8: { to: "/sar" },
  O9: { to: "/news" },
  O14: {
    to: "/",
    hash: "e-service",
    resetScroll: false,
    hashScrollIntoView: false
  }
} as const;

beforeEach(() => {
  routerMocks.navigate.mockReset();
});

describe("PublicIta2569Page", () => {
  it("renders all O1-O23 items with the configured labels and hrefs", () => {
    const { container } = render(<PublicIta2569Page />);

    expect(screen.getByText("วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด")).toBeInTheDocument();
    expect(screen.getByText("ตัวชี้วัดที่ 9 การเปิดเผยข้อมูล")).toBeInTheDocument();
    expect(screen.getByText("ตัวชี้วัดที่ 10 การป้องกันการทุจริต")).toBeInTheDocument();

    const itemCodes = Array.from(container.querySelectorAll("[data-ita-code]"), (element) =>
      element.getAttribute("data-ita-code")
    );
    expect(itemCodes).toEqual(Array.from({ length: 23 }, (_, index) => `O${index + 1}`));
    expect(screen.queryByText("รอใส่ลิงก์")).not.toBeInTheDocument();

    Object.entries(EXPECTED_LINKS).forEach(([code, href]) => {
      const item = container.querySelector(`[data-ita-code="${code}"]`);
      expect(item).not.toBeNull();

      const link = within(item as HTMLElement).getByRole("link", { name: "เปิดข้อมูล" });
      expect(link).toHaveAttribute("href", href);
    });
  });

  it("uses client-side navigation for every internal RCAT link and preserves E-Service hash scrolling", () => {
    const { container } = render(<PublicIta2569Page />);

    Object.entries(INTERNAL_NAVIGATIONS).forEach(([code, expectedNavigation]) => {
      const item = container.querySelector(`[data-ita-code="${code}"]`);
      expect(item).not.toBeNull();

      const link = within(item as HTMLElement).getByRole("link", { name: "เปิดข้อมูล" });
      expect(link).not.toHaveAttribute("target");

      fireEvent.click(link);
      expect(routerMocks.navigate).toHaveBeenLastCalledWith(expectedNavigation);
    });

    expect(routerMocks.navigate).toHaveBeenCalledTimes(Object.keys(INTERNAL_NAVIGATIONS).length);
  });

  it("keeps external document links external and does not route them through the SPA", () => {
    const { container } = render(<PublicIta2569Page />);

    const externalCodes = Object.entries(EXPECTED_LINKS)
      .filter(([, href]) => !href.startsWith("https://www.rcat.ac.th/"))
      .map(([code]) => code);

    externalCodes.forEach((code) => {
      const item = container.querySelector(`[data-ita-code="${code}"]`);
      expect(item).not.toBeNull();

      const link = within(item as HTMLElement).getByRole("link", { name: "เปิดข้อมูล" });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    });

    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });
});
