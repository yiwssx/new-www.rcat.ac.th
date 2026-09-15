import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import FacebookPostEmbed from "./FacebookPostEmbed";

const facebookPostUrl = "https://www.facebook.com/100063746585360/posts/111";
const facebookReelUrl = "https://www.facebook.com/reel/859331548878917/";

beforeEach(() => {
  document.getElementById("facebook-jssdk")?.remove();
  document.getElementById("fb-root")?.remove();
});

describe("FacebookPostEmbed", () => {
  it("renders a responsive lazy Facebook post iframe and source link", () => {
    render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const iframeSrc = iframe.getAttribute("src") || "";
    const pluginUrl = new URL(iframeSrc);

    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl.searchParams.get("href")).toBe(facebookPostUrl);
    expect(pluginUrl.searchParams.get("show_text")).toBe("true");
    expect(pluginUrl.searchParams.get("width")).toBe("500");
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe).toHaveAttribute("scrolling", "no");
    expect(iframe).toHaveAttribute("allowfullscreen");
    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);
  });

  it("renders a Facebook Reel with the responsive SDK video plugin", async () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookReelUrl} />);

    await waitFor(() => {
      expect(container.querySelector(".fb-video")).toBeInTheDocument();
    });

    const sdkHost = container.querySelector('[data-facebook-reel-sdk-embed="true"]');
    const reelPlugin = container.querySelector(".fb-video");
    const sdkScript = document.getElementById("facebook-jssdk");

    expect(sdkHost).toBeInTheDocument();
    expect(reelPlugin).toHaveAttribute("data-href", facebookReelUrl);
    expect(reelPlugin).toHaveAttribute("data-width", "320");
    expect(reelPlugin).toHaveAttribute("data-show-text", "false");
    expect(screen.queryByTitle("Facebook Reel")).not.toBeInTheDocument();
    expect(sdkScript).toHaveAttribute("src", expect.stringContaining("https://connect.facebook.net/th_TH/sdk.js"));
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute("href", facebookReelUrl);
  });

  it("shows a safe fallback for invalid URLs", () => {
    render(<FacebookPostEmbed postUrl="https://example.com/not-facebook" />);

    expect(screen.queryByTitle("Facebook post")).not.toBeInTheDocument();
    expect(screen.getByText("ไม่สามารถแสดงโพสต์ Facebook แบบฝังได้")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ดูโพสต์ต้นทางบน Facebook" })).toHaveAttribute(
      "href",
      "https://example.com/not-facebook"
    );
  });

  it("shows a fallback message without a source button when the URL is missing", () => {
    render(<FacebookPostEmbed postUrl="" />);

    expect(screen.queryByTitle("Facebook post")).not.toBeInTheDocument();
    expect(screen.getByText("ไม่สามารถแสดงโพสต์ Facebook แบบฝังได้")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ดูโพสต์ต้นทางบน Facebook" })).not.toBeInTheDocument();
  });
});
