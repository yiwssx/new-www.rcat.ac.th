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

beforeEach(() => {
  document.getElementById("facebook-jssdk")?.remove();
  document.getElementById("fb-root")?.remove();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => apiResponse({ ok: true, kind: "post", canonicalUrl: facebookPostUrl }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FacebookPostEmbed", () => {
  it("keeps a regular post desktop embed while mobile always gets the local preview", async () => {
    const { container } = render(
      <FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" previewImageUrl={previewImageUrl} />
    );

    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const iframeSrc = iframe.getAttribute("src") || "";
    const pluginUrl = new URL(iframeSrc);
    const mobilePreview = container.querySelector('[data-facebook-mobile-local-preview="true"]');
    const poster = mobilePreview?.querySelector('[data-public-responsive-image-element="true"]');

    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl.searchParams.get("href")).toBe(facebookPostUrl);
    expect(iframe).toHaveAttribute("loading", "eager");
    expect(container.querySelector('[data-facebook-desktop-embed="true"]')).toBeInTheDocument();
    expect(mobilePreview).toBeInTheDocument();
    expect(poster).toHaveAttribute("src", previewImageUrl);
    expect(screen.getByText("โพสต์ Facebook")).toBeInTheDocument();
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

  it("keeps Facebook's minimum plugin width and visually scales regular desktop posts", () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    const pluginHost = container.querySelector('[data-facebook-plugin-embed="true"]');
    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const pluginUrl = new URL(iframe.getAttribute("src") || "");

    expect(pluginHost).toHaveAttribute("data-facebook-plugin-render-width", "350");
    expect(pluginHost).toHaveAttribute("data-facebook-plugin-visual-scale", "0.914");
    expect(pluginUrl.searchParams.get("width")).toBe("350");
    expect(pluginUrl.searchParams.get("show_text")).toBe("true");
  });

  it("converts a historical Reel only for desktop embedding while mobile remains local", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => apiResponse({ ok: true, kind: "reel", canonicalUrl: canonicalReelUrl }))
    );

    const { container } = render(
      <FacebookPostEmbed postUrl={historicalReelPostUrl} title="วิดีโอจาก Facebook" previewImageUrl={previewImageUrl} />
    );

    expect(screen.getByTitle("วิดีโอจาก Facebook")).toBeInTheDocument();
    expect(container.querySelector('[data-facebook-mobile-local-preview="true"]')).toBeInTheDocument();

    await waitFor(() => {
      expect(container.querySelector('[data-facebook-mobile-reel-fallback="true"]')).toBeInTheDocument();
    });

    const mobileFallback = container.querySelector('[data-facebook-mobile-reel-fallback="true"]');
    const poster = mobileFallback?.querySelector('[data-public-responsive-image-element="true"]');
    const reelPlugin = container.querySelector(".fb-video");

    expect(mobileFallback?.tagName).toBe("DIV");
    expect(mobileFallback).not.toHaveAttribute("href");
    expect(poster).toHaveAttribute("src", previewImageUrl);
    expect(poster).toHaveAttribute("alt", "ภาพตัวอย่าง วิดีโอจาก Facebook");
    expect(screen.getByText("วิดีโอ Facebook")).toBeInTheDocument();
    expect(
      screen.getByText("แสดงตัวอย่างจากเว็บไซต์เพื่อหลีกเลี่ยงปัญหาลิงก์ฝัง Facebook บนมือถือ")
    ).toBeInTheDocument();
    expect(reelPlugin).toHaveAttribute("data-href", canonicalReelUrl);
    expect(container.querySelector('[data-facebook-desktop-embed="true"]')).toBeInTheDocument();
    expect(screen.queryByTitle("วิดีโอจาก Facebook")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute(
      "href",
      historicalReelPostUrl
    );
    expect(fetch).toHaveBeenCalledWith(
      resolverUrl(historicalReelPostUrl),
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  it("renders canonical Reels with the local mobile preview immediately and SDK only in the desktop host", () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookReelUrl} previewImageUrl={previewImageUrl} />);

    const mobileFallback = container.querySelector('[data-facebook-mobile-reel-fallback="true"]');
    const poster = mobileFallback?.querySelector('[data-public-responsive-image-element="true"]');

    expect(mobileFallback).toBeInTheDocument();
    expect(mobileFallback?.tagName).toBe("DIV");
    expect(mobileFallback).not.toHaveAttribute("href");
    expect(poster).toHaveAttribute("src", previewImageUrl);
    expect(container.querySelector(".fb-video")).toHaveAttribute("data-href", facebookReelUrl);
    expect(container.querySelector('[data-facebook-desktop-embed="true"]')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute("href", facebookReelUrl);
  });

  it("keeps a local mobile preview even if the resolver is temporarily unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => apiResponse({ ok: false }, false))
    );

    const { container } = render(
      <FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" previewImageUrl={previewImageUrl} />
    );

    expect(screen.getByTitle("ข่าวจาก Facebook")).toBeInTheDocument();
    expect(container.querySelector('[data-facebook-mobile-local-preview="true"]')).toBeInTheDocument();
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
