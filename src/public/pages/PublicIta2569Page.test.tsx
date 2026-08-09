import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

beforeEach(() => {
  routerMocks.navigate.mockReset();
});

describe("PublicIta2569Page", () => {
  it("renders the college ITA 2569 page with all O1-O23 disclosure items", () => {
    const { container } = render(<PublicIta2569Page />);

    expect(screen.getByText("วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด")).toBeInTheDocument();
    expect(screen.getByText("ตัวชี้วัดที่ 9 การเปิดเผยข้อมูล")).toBeInTheDocument();
    expect(screen.getByText("ตัวชี้วัดที่ 10 การป้องกันการทุจริต")).toBeInTheDocument();
    expect(screen.getByText("โครงสร้างและอำนาจหน้าที่")).toBeInTheDocument();
    expect(screen.getByText("มาตรการส่งเสริมคุณธรรมและความโปร่งใสภายในสถานศึกษา")).toBeInTheDocument();

    const itemCodes = Array.from(container.querySelectorAll("[data-ita-code]"), (element) =>
      element.getAttribute("data-ita-code")
    );
    expect(itemCodes).toEqual(Array.from({ length: 23 }, (_, index) => `O${index + 1}`));
  });

  it("keeps placeholders for empty links and routes E-Service to the homepage hash without a document reload", () => {
    render(<PublicIta2569Page />);

    expect(screen.getAllByText("รอใส่ลิงก์")).toHaveLength(22);

    const eServiceLink = screen.getByRole("link", { name: "เข้าสู่ E-Service" });
    expect(eServiceLink).toHaveAttribute("href", "/#e-service");
    expect(eServiceLink).not.toHaveAttribute("target");

    fireEvent.click(eServiceLink);

    expect(routerMocks.navigate).toHaveBeenCalledTimes(1);
    expect(routerMocks.navigate).toHaveBeenCalledWith({
      to: "/",
      hash: "e-service",
      resetScroll: false,
      hashScrollIntoView: false
    });
  });
});
