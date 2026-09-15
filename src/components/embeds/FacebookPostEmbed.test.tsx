import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FacebookPostEmbed from "./FacebookPostEmbed";

const facebookPostUrl = "https://www.facebook.com/1609435494524655/posts/111";
const historicalReelPostUrl = "https://www.facebook.com/1609435494524655/posts/1639846248150246";
const canonicalReelUrl = "https://www.facebook.com/reel/1639846248150246/";
const facebookReelUrl = "https://www.facebook.com/reel/859331548878917/";
const previewImageUrl = "https://images.example.com/facebook-reel-preview.jpg";
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

function installFacebookPreviewMeta() {
  const meta = document.createElement("meta");
  meta.setAttribute("property", "og:image");
  meta.setAttribute("data-facebook-test-preview", "true");
  meta.content = previewImageUrl;
  document.head.appendChild(meta);
}

beforeEach(() => {
  document.getElementById("facebook-jssdk")?.remove();
  document.getElementById("fb-root")?.remove();
  document.querySelector('meta[data-facebook-test-preview="true"]')?.remove();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => apiResponse({ ok: true, kind: "post", canonicalUrl: facebookPostUrl }))
  );
});

afterEach(() => {
  document.querySelector('meta[data-facebook-test-preview="true"]')?.remove();
  vi.unstubAllGlobals();
});

describe("FacebookPostEmbed", () => {
  it("keeps a regular post visible while checking whether the historical URL is a Reel", async () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const iframeSrc = iframe.getAttribute("src") || "";
    const pluginUrl = new URL(iframeSrc);

    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl.searchParams.get("href")).toBe(facebookPostUrl);
    expect(iframe).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);
    expect(container.querySelector('[data-facebook-mobile-reel-fallback="true"]')).not.toBeInTheDocument();
    expect(document.getElementById("facebook-jssdk")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        resolverUrl(facebookPostUrl),
        expect.objectContaining({ method: "GET", cache: "no-store" })
      );
    });
  });

  it("keeps Facebook's minimum plugin width and visually scales regular posts for narrow mobile containers", () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    const pluginHost = container.querySelector('[data-facebook-plugin-embed="true"]');
    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const pluginUrl = new URL(iframe.getAttribute("src") || "");

    expect(pluginHost).toHaveAttribute("data-facebook-plugin-render-width", "350");
    expect(pluginHost).toHaveAttribute("data-facebook-plugin-visual-scale", "0.914");
    expect(pluginUrl.searchParams.get("width")).toBe("350");
    expect(pluginUrl.searchParams.get("show_text")).toBe("true");
  });

  it("converts a historical Reel and guarantees a local mobile poster instead of relying on Facebook playback", async () => {
    installFacebookPreviewMeta();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => apiResponse({ ok: true, kind: "reel", canonicalUrl: canonicalReelUrl }))
    );

    const { container } = render(<FacebookPostEmbed postUrl={historicalReelPostUrl} title="วิดีโอจาก Facebook" />);

    expect(screen.getByTitle("วิดีโอจาก Facebook")).toBeInTheDocument();

    await waitFor(() => {
      expect(container.querySelector('[data-facebook-mobile-reel-fallback="true"]')).toBeInTheDocument();
    });

    const mobileFallback = container.querySelector('[data-facebook-mobile-reel-fallback="true"]');
    const poster = mobileFallback?.querySelector('[data-public-responsive-image-element="true"]');
    const reelPlugin = container.querySelector(".fb-video");

    expect(mobileFallback).toHaveAttribute("href", canonicalReelUrl);
    expect(poster).toHaveAttribute("src", previewImageUrl);
    expect(poster).toHaveAttribute("alt", "ภาพตัวอย่าง วิดีโอจาก Facebook");
    expect(screen.getByText("แตะเพื่อเล่น Reels บน Facebook")).toBeInTheDocument();
    expect(reelPlugin).toHaveAttribute("data-href", canonicalReelUrl);
    expect(container.querySelector('[data-facebook-desktop-reel-embed="true"]')).toBeInTheDocument();
    expect(screen.queryByTitle("วิดีโอจาก Facebook")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute(
      "href",
      canonicalReelUrl
    );
    expect(fetch).toHaveBeenCalledWith(
      resolverUrl(historicalReelPostUrl),
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  it("renders canonical Reels with a mobile fallback immediately and keeps the SDK path only for desktop", async () => {
    installFacebookPreviewMeta();
    const { container } = render(<FacebookPostEmbed postUrl={facebookReelUrl} />);

    await waitFor(() => {
      expect(container.querySelector('[data-facebook-mobile-reel-fallback="true"]')).toBeInTheDocument();
    });

    const mobileFallback = container.querySelector('[data-facebook-mobile-reel-fallback="true"]');
    const poster = mobileFallback?.querySelector('[data-public-responsive-image-element="true"]');

    expect(mobileFallback).toHaveAttribute("href", facebookReelUrl);
    expect(poster).toHaveAttribute("src", previewImageUrl);
    expect(container.querySelector(".fb-video")).toHaveAttribute("data-href", facebookReelUrl);
    expect(container.querySelector('[data-facebook-desktop-reel-embed="true"]')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute("href", facebookReelUrl);
  });

  it("keeps the proven post iframe if the resolver is temporarily unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => apiResponse({ ok: false }, false))
    );

    const { container } = render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    expect(screen.getByTitle("ข่าวจาก Facebook")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);
    expect(container.querySelector('[data-facebook-mobile-reel-fallback="true"]')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTitle("ข่าวจาก Facebook")).toBeInTheDocument();
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
