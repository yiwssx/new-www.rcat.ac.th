import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ContentBlocksRenderer from "../shared/components/ContentBlocksRenderer";

describe("ContentBlocksRenderer", () => {
  beforeEach(() => {
    document.getElementById("facebook-jssdk")?.remove();
  });

  it("does not render invalid Facebook post URLs", () => {
    const { container } = render(
      <ContentBlocksRenderer
        mediaAssets={[]}
        blocks={[
          {
            id: "facebook-1",
            type: "facebookPost",
            href: "https://example.com/post",
            caption: "Should not render",
            showText: true,
            width: 500
          }
        ]}
      />
    );

    expect(container.querySelector(".fb-post")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Facebook post")).not.toBeInTheDocument();
    expect(screen.queryByText("Should not render")).not.toBeInTheDocument();
  });

  it("renders Facebook post iframe plugin markup for valid URLs", () => {
    const { container } = render(
      <ContentBlocksRenderer
        mediaAssets={[]}
        blocks={[
          {
            id: "facebook-1",
            type: "facebookPost",
            href: "https://www.facebook.com/rcat/posts/12345",
            caption: "Official Facebook post",
            showText: true,
            width: 900
          }
        ]}
      />
    );

    const iframe = screen.getByTitle("Facebook post");
    const iframeSrc = iframe.getAttribute("src") || "";
    const pluginUrl = new URL(iframeSrc);

    expect(container.querySelector(".fb-post")).not.toBeInTheDocument();
    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(iframeSrc).toContain("href=https%3A%2F%2Fwww.facebook.com%2Frcat%2Fposts%2F12345");
    expect(pluginUrl.searchParams.get("href")).toBe("https://www.facebook.com/rcat/posts/12345");
    expect(pluginUrl.searchParams.get("show_text")).toBe("true");
    expect(pluginUrl.searchParams.get("width")).toBe("750");
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe).toHaveAttribute("scrolling", "no");
    expect(iframe).toHaveAttribute("width", "750");
    expect(iframe).toHaveAttribute("height", "761");
    expect(screen.getByText("Official Facebook post")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดโพสต์บน Facebook" })).toHaveAttribute(
      "href",
      "https://www.facebook.com/rcat/posts/12345"
    );
    expect(document.getElementById("facebook-jssdk")).not.toBeInTheDocument();
  });
});
