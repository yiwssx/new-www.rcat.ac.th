import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import FacebookPostEmbed from "./FacebookPostEmbed";

const facebookPostUrl = "https://www.facebook.com/1609435494524655/posts/111";
const facebookReelUrl = "https://www.facebook.com/reel/859331548878917/";

beforeEach(() => {
  document.getElementById("facebook-jssdk")?.remove();
  document.getElementById("fb-root")?.remove();
});

describe("FacebookPostEmbed", () => {
  it("uses the official Facebook post iframe plugin for regular posts", () => {
    render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const iframeSrc = iframe.getAttribute("src") || "";
    const pluginUrl = new URL(iframeSrc);

    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl.searchParams.get("href")).toBe(facebookPostUrl);
    expect(iframe).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);
    expect(document.getElementById("facebook-jssdk")).not.toBeInTheDocument();
  });

  it("keeps Facebook's minimum plugin width and visually scales it for narrow mobile containers", async () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    await waitFor(() => {
      expect(container.querySelector('[data-facebook-plugin-embed="true"]')).toBeInTheDocument();
    });

    const pluginHost = container.querySelector('[data-facebook-plugin-embed="true"]');
    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const pluginUrl = new URL(iframe.getAttribute("src") || "");

    expect(pluginHost).toHaveAttribute("data-facebook-plugin-render-width", "350");
    expect(pluginHost).toHaveAttribute("data-facebook-plugin-visual-scale", "0.914");
    expect(pluginUrl.searchParams.get("width")).toBe("350");
    expect(pluginUrl.searchParams.get("show_text")).toBe("true");
    expect(document.getElementById("facebook-jssdk")).not.toBeInTheDocument();
  });

  it("renders direct Facebook Reels through the post iframe plugin instead of the blank-prone SDK video path", () => {
    render(<FacebookPostEmbed postUrl={facebookReelUrl} />);

    const iframe = screen.getByTitle("Facebook Reel");
    const pluginUrl = new URL(iframe.getAttribute("src") || "");

    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl.searchParams.get("href")).toBe(facebookReelUrl);
    expect(pluginUrl.searchParams.get("show_text")).toBe("true");
    expect(document.getElementById("facebook-jssdk")).not.toBeInTheDocument();
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
