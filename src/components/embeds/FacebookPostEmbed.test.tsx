import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FacebookPostEmbed from "./FacebookPostEmbed";

const facebookPostUrl = "https://www.facebook.com/1609435494524655/posts/111";
const historicalReelPostUrl = "https://www.facebook.com/1609435494524655/posts/1639846248150246";
const canonicalReelUrl = "https://www.facebook.com/reel/1639846248150246/";
const facebookReelUrl = "https://www.facebook.com/reel/859331548878917/";

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
  it("resolves regular posts before using the official Facebook post iframe plugin", async () => {
    render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    expect(screen.getByRole("status", { name: "กำลังตรวจสอบเนื้อหา Facebook" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTitle("ข่าวจาก Facebook")).toBeInTheDocument();
    });

    const iframe = screen.getByTitle("ข่าวจาก Facebook");
    const iframeSrc = iframe.getAttribute("src") || "";
    const pluginUrl = new URL(iframeSrc);

    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl.searchParams.get("href")).toBe(facebookPostUrl);
    expect(iframe).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);
    expect(document.getElementById("facebook-jssdk")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      `/api/facebook-oembed?url=${encodeURIComponent(facebookPostUrl)}`,
      expect.objectContaining({ method: "GET" })
    );
  });

  it("keeps Facebook's minimum plugin width and visually scales regular posts for narrow mobile containers", async () => {
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
  });

  it("converts a historical /posts/{reel-id} URL to the canonical Reel before mobile rendering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => apiResponse({ ok: true, kind: "reel", canonicalUrl: canonicalReelUrl }))
    );

    const { container } = render(<FacebookPostEmbed postUrl={historicalReelPostUrl} />);

    await waitFor(() => {
      expect(container.querySelector(".fb-video")).toBeInTheDocument();
    });

    const reelPlugin = container.querySelector(".fb-video");
    expect(reelPlugin).toHaveAttribute("data-href", canonicalReelUrl);
    expect(container.querySelector('[data-facebook-reel-sdk-embed="true"]')).toBeInTheDocument();
    expect(screen.queryByTitle("Facebook post")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute(
      "href",
      canonicalReelUrl
    );
  });

  it("renders already canonical Facebook Reel URLs directly without an oEmbed classification request", async () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookReelUrl} />);

    await waitFor(() => {
      expect(container.querySelector(".fb-video")).toBeInTheDocument();
    });

    expect(container.querySelector(".fb-video")).toHaveAttribute("data-href", facebookReelUrl);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "เปิด Reels ต้นทางบน Facebook" })).toHaveAttribute("href", facebookReelUrl);
  });

  it("falls back to the proven post iframe if the resolver is temporarily unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => apiResponse({ ok: false }, false)));

    render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    await waitFor(() => {
      expect(screen.getByTitle("ข่าวจาก Facebook")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);
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
