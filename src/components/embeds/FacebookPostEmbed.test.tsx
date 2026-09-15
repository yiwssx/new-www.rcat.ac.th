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
  it("renders /posts/ permalinks with the responsive SDK post plugin", async () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookPostUrl} title="ข่าวจาก Facebook" />);

    await waitFor(() => {
      expect(container.querySelector(".fb-post")).toBeInTheDocument();
    });

    const sdkHost = container.querySelector('[data-facebook-sdk-embed="true"]');
    const postPlugin = container.querySelector(".fb-post");
    const sdkScript = document.getElementById("facebook-jssdk");

    expect(sdkHost).toHaveAttribute("data-facebook-sdk-embed-mode", "post");
    expect(postPlugin).toHaveAttribute("data-href", facebookPostUrl);
    expect(postPlugin).toHaveAttribute("data-width", "320");
    expect(postPlugin).toHaveAttribute("data-show-text", "true");
    expect(screen.queryByTitle("ข่าวจาก Facebook")).not.toBeInTheDocument();
    expect(sdkScript).toHaveAttribute("src", expect.stringContaining("https://connect.facebook.net/th_TH/sdk.js"));
    expect(screen.getByRole("link", { name: "เปิดโพสต์ต้นทางบน Facebook" })).toHaveAttribute("href", facebookPostUrl);
  });

  it("renders a Facebook Reel with the responsive SDK video plugin", async () => {
    const { container } = render(<FacebookPostEmbed postUrl={facebookReelUrl} />);

    await waitFor(() => {
      expect(container.querySelector(".fb-video")).toBeInTheDocument();
    });

    const sdkHost = container.querySelector('[data-facebook-sdk-embed="true"]');
    const reelPlugin = container.querySelector(".fb-video");
    const sdkScript = document.getElementById("facebook-jssdk");

    expect(sdkHost).toHaveAttribute("data-facebook-sdk-embed-mode", "video");
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
