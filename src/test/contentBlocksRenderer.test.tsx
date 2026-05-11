import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ContentBlocksRenderer from "../shared/components/ContentBlocksRenderer";

describe("ContentBlocksRenderer", () => {
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
    expect(screen.queryByText("Should not render")).not.toBeInTheDocument();
  });

  it("renders Facebook post plugin markup for valid URLs", () => {
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
            width: 520
          }
        ]}
      />
    );

    const embed = container.querySelector(".fb-post");

    expect(embed).toBeInTheDocument();
    expect(embed).toHaveAttribute("data-href", "https://www.facebook.com/rcat/posts/12345");
    expect(embed).toHaveAttribute("data-width", "520");
    expect(embed).toHaveAttribute("data-show-text", "true");
    expect(screen.getByText("Official Facebook post")).toBeInTheDocument();
  });
});
