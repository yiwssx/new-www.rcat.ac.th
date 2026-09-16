import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FacebookPostEmbed from "./FacebookPostEmbed";

const facebookPostUrl = "https://www.facebook.com/1609435494524655/posts/111";
const historicalReelPostUrl = "https://www.facebook.com/1609435494524655/posts/1639846248150246";
const facebookReelUrl = "https://www.facebook.com/reel/859331548878917/";
const previewImageUrl = "https://images.example.com/facebook-reel-preview.jpg";

beforeEach(() => {
  document.getElementById("facebook-jssdk")?.remove();
  document.getElementById("fb-root")?.remove();
  vi.stubGlobal("FB", { XFBML: { parse: vi.fn() } });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FacebookPostEmbed", () => {
  it("renders a regular Facebook post as a live iframe on every breakpoint", () => {
    const { container } = render(
      <FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" previewImageUrl={previewImageUrl} />
    );

    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const iframeSrc = iframe.getAttribute("src") || "";
    const pluginUrl = new URL(iframeSrc);

    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl.searchParams.get("href")).toBe(facebookPostUrl);
    expect(iframe).toHaveAttribute("loading", "eager");
    expect(container.querySelector('[data-facebook-plugin-embed="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-facebook-reel-sdk-embed="true"]')).not.toBeInTheDocument();
    expect(container.querySelector(".fb-video")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps Facebook's minimum plugin width and visually scales narrow posts", () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    const pluginHost = container.querySelector('[data-facebook-plugin-embed="true"]');
    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const pluginUrl = new URL(iframe.getAttribute("src") || "");

    expect(pluginHost).toHaveAttribute("data-facebook-plugin-render-width", "350");
    expect(pluginHost).toHaveAttribute("data-facebook-plugin-visual-scale", "0.914");
    expect(pluginUrl.searchParams.get("width")).toBe("350");
    expect(pluginUrl.searchParams.get("show_text")).toBe("true");
  });

  it("renders the confirmed historical Reel with the SDK using its real stored permalink", async () => {
    const { container } = render(
      <FacebookPostEmbed postUrl={historicalReelPostUrl} title="วิดีโอจาก Facebook" previewImageUrl={previewImageUrl} />
    );

    await waitFor(() => {
      expect(container.querySelector(".fb-video")).toBeInTheDocument();
    });

    const reel = container.querySelector(".fb-video");
    expect(reel).toHaveAttribute("data-href", historicalReelPostUrl);
    expect(reel).toHaveAttribute("data-show-text", "false");
    expect(container.querySelector('[data-facebook-plugin-embed="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-reel-sdk-embed="true"]')).toBeInTheDocument();
    expect(screen.queryByTitle("วิดีโอจาก Facebook")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute(
      "href",
      historicalReelPostUrl
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders canonical Reels directly with the Meta SDK video player", async () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookReelUrl} previewImageUrl={previewImageUrl} />);

    await waitFor(() => {
      expect(container.querySelector(".fb-video")).toBeInTheDocument();
    });

    const reel = container.querySelector(".fb-video");
    expect(reel).toHaveAttribute("data-href", facebookReelUrl);
    expect(container.querySelector('[data-facebook-plugin-embed="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-reel-sdk-embed="true"]')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute("href", facebookReelUrl);
  });

  it("never promotes an ordinary /posts/ URL to a Reel", () => {
    const ordinaryPostUrl = "https://www.facebook.com/1609435494524655/posts/9999999999999999";
    const { container } = render(<FacebookPostEmbed postUrl={ordinaryPostUrl} title="โพสต์ปกติ" />);

    const iframe = screen.getByTitle("โพสต์ปกติ");
    const pluginUrl = new URL(iframe.getAttribute("src") || "");

    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl.searchParams.get("href")).toBe(ordinaryPostUrl);
    expect(container.querySelector(".fb-video")).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-reel-sdk-embed="true"]')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a safe fallback for invalid URLs", () => {
    render(<FacebookPostEmbed postUrl="https://example.com/not-facebook" />);

    expect(screen.queryByTitle("Facebook post")).not.toBeInTheDocument();
    expect(screen.getByText("ไม่สามารถแสดงโพสต์ Facebook แบบฝังได้")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ดูโพสต์ต้นทางบน Facebook" })).toHaveAttribute(
      "href",
      "https://example.com/not-facebook"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a fallback message without a source button when the URL is missing", () => {
    render(<FacebookPostEmbed postUrl="" />);

    expect(screen.queryByTitle("Facebook post")).not.toBeInTheDocument();
    expect(screen.getByText("ไม่สามารถแสดงโพสต์ Facebook แบบฝังได้")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ดูโพสต์ต้นทางบน Facebook" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
