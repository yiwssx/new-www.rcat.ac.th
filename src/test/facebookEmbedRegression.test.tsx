import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ContentBlocksRenderer from "../shared/components/ContentBlocksRenderer";

const facebookPermalinkUrl =
  "https://www.facebook.com/permalink.php?story_fbid=pfbid02Deg7YhzG98yCAuK44Tne3Sdx6x9gM4GXLEnmesPwmQ1pe8htSsPCTyE8WqfkBVBil&id=100063746585360";

beforeEach(() => {
  document.getElementById("facebook-jssdk")?.remove();
});

describe("Facebook embed regressions", () => {
  it("renders a lazy Facebook plugin iframe and fallback link for a valid permalink", () => {
    const { container } = render(
      <ContentBlocksRenderer
        mediaAssets={[]}
        blocks={[
          {
            id: "facebook-1",
            type: "facebookPost",
            href: facebookPermalinkUrl,
            caption: "",
            showText: true,
            width: 500
          }
        ]}
      />
    );

    const iframe = screen.getByTitle("Facebook post");
    const iframeSrc = iframe.getAttribute("src") || "";
    const pluginUrl = new URL(iframeSrc);

    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(iframeSrc).toContain(`href=${encodeURIComponent(facebookPermalinkUrl)}`);
    expect(pluginUrl.searchParams.get("href")).toBe(facebookPermalinkUrl);
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(screen.getByRole("link", { name: "เปิดโพสต์บน Facebook" })).toHaveAttribute("href", facebookPermalinkUrl);
    expect(document.getElementById("facebook-jssdk")).not.toBeInTheDocument();
    expect(container.querySelector(".fb-post")).not.toBeInTheDocument();
  });

  it("does not render iframe plugin markup for invalid or unsafe non-Facebook URLs", () => {
    const { container } = render(
      <ContentBlocksRenderer
        mediaAssets={[]}
        blocks={[
          {
            id: "facebook-1",
            type: "facebookPost",
            href: "https://example.com/not-facebook",
            caption: "Unsafe embed",
            showText: true,
            width: 500
          }
        ]}
      />
    );

    expect(screen.queryByTitle("Facebook post")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "เปิดโพสต์บน Facebook" })).not.toBeInTheDocument();
    expect(screen.queryByText("Unsafe embed")).not.toBeInTheDocument();
    expect(document.getElementById("facebook-jssdk")).not.toBeInTheDocument();
    expect(container.querySelector(".fb-post")).not.toBeInTheDocument();
  });
});
