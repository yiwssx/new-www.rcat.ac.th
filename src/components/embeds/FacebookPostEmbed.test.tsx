import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FacebookPostEmbed from "./FacebookPostEmbed";

const facebookPostUrl = "https://www.facebook.com/1609435494524655/posts/111";
const historicalReelPostUrl = "https://www.facebook.com/1609435494524655/posts/1639846248150246";
const facebookReelUrl = "https://www.facebook.com/reel/859331548878917/";
const previewImageUrl = "https://images.example.com/facebook-reel-preview.jpg";
const cachedHistoricalPreviewUrl =
  "https://drive.google.com/thumbnail?id=1NFMVP_bpiaxHMt-8nyVZOGTuvlyVKdv-&sz=w1200";
const facebookOembedRevision = "legacy-reel-v2";
const resolverUrl = (url: string) =>
  `/api/ssr?_rcatFacebookOembed=1&url=${encodeURIComponent(url)}&_rcatFacebookOembedRevision=${facebookOembedRevision}`;

function apiResponse(payload: unknown, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    }
  };
}

beforeEach(() => {
  document.getElementById("facebook-jssdk")?.remove();
  document.getElementById("fb-root")?.remove();
  vi.stubGlobal("FB", { XFBML: { parse: vi.fn() } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => apiResponse({ ok: true, kind: "post", canonicalUrl: facebookPostUrl }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FacebookPostEmbed", () => {
  it("renders a regular Facebook post as a live iframe on every breakpoint", async () => {
    const { container } = render(
      <FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" previewImageUrl={previewImageUrl} />
    );

    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const iframeSrc = iframe.getAttribute("src") || "";
    const pluginUrl = new URL(iframeSrc);

    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl.searchParams.get("href")).toBe(facebookPostUrl);
    expect(iframe).toHaveAttribute("loading", "eager");
    expect(container.querySelector('[data-facebook-local-preview="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-plugin-embed="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-facebook-reel-sdk-embed="true"]')).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        resolverUrl(facebookPostUrl),
        expect.objectContaining({ method: "GET", cache: "no-store" })
      );
    });
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

  it("uses the local preview for the confirmed unavailable historical Reel", () => {
    const { container } = render(
      <FacebookPostEmbed postUrl={historicalReelPostUrl} title="วิดีโอจาก Facebook" previewImageUrl={previewImageUrl} />
    );

    const preview = container.querySelector('[data-facebook-local-preview="true"]');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute("src", previewImageUrl);
    expect(preview).toHaveAttribute("alt", "วิดีโอจาก Facebook");
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
    expect(container.querySelector(".fb-video")).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-plugin-embed="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-reel-sdk-embed="true"]')).not.toBeInTheDocument();
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
    expect(container.querySelector('[data-facebook-local-preview="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-plugin-embed="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-reel-sdk-embed="true"]')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute("href", facebookReelUrl);
  });

  it("keeps the live regular post embed if the resolver is temporarily unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => apiResponse({ ok: false }, false))
    );

    const { container } = render(
      <FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" previewImageUrl={previewImageUrl} />
    );

    expect(screen.getByTitle("ข่าวจาก Facebook")).toBeInTheDocument();
    expect(container.querySelector('[data-facebook-local-preview="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-plugin-embed="true"]')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTitle("ข่าวจาก Facebook")).toBeInTheDocument();
  });

  it("uses the cached preview for the unavailable historical Reel when no preview prop is supplied", () => {
    const { container } = render(<FacebookPostEmbed postUrl={historicalReelPostUrl} title="วิดีโอจาก Facebook" />);

    const preview = container.querySelector('[data-facebook-local-preview="true"]');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute("src", cachedHistoricalPreviewUrl);
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
    expect(container.querySelector(".fb-video")).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-plugin-embed="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-facebook-reel-sdk-embed="true"]')).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute(
      "href",
      historicalReelPostUrl
    );
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
