import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicResponsiveImage from "../shared/media/PublicResponsiveImage";

describe("PublicResponsiveImage layout modes", () => {
  it("preserves the existing fill layout behavior", () => {
    render(
      <PublicResponsiveImage
        source="/fixture/fill.svg"
        intent="content-card"
        alt="Fill fixture"
        loadMode="eager"
        fill
      />
    );

    const image = screen.getByRole("img", { name: "Fill fixture" });
    const wrapper = image.closest('[data-public-responsive-image="true"]');
    const style = window.getComputedStyle(image);

    expect(wrapper).toHaveAttribute("data-public-image-layout", "fill");
    expect(wrapper).toHaveAttribute("data-public-image-fill", "true");
    expect(style.position).toBe("absolute");
    expect(style.width).toBe("100%");
    expect(style.height).toBe("100%");
  });

  it("supports intrinsic constrained sizing without changing fill consumers", () => {
    render(
      <div style={{ maxHeight: "300px" }}>
        <PublicResponsiveImage
          source="/fixture/intrinsic.svg"
          intent="intro-gate"
          alt="Intrinsic fixture"
          loadMode="eager"
          intrinsic
        />
      </div>
    );

    const image = screen.getByRole("img", { name: "Intrinsic fixture" });
    const wrapper = image.closest('[data-public-responsive-image="true"]');
    const style = window.getComputedStyle(image);

    expect(wrapper).toHaveAttribute("data-public-image-layout", "intrinsic");
    expect(wrapper).toHaveAttribute("data-public-image-fill", "false");
    expect(style.position).not.toBe("absolute");
    expect(style.width).toBe("auto");
    expect(style.height).toBe("auto");
    expect(style.maxWidth).toBe("100%");
    expect(style.maxHeight).toBe("inherit");
  });
});
