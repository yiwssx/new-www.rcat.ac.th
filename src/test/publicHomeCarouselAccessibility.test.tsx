import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicHomeCarousel from "../public/components/PublicHomeCarousel";
import type { CarouselSlide } from "../types";

const slides: CarouselSlide[] = [
  {
    id: "slide-1",
    title: "Slide 1",
    subtitle: "",
    chip: "",
    imageUrl: "https://example.edu/slide-1.jpg",
    imageAlt: "Slide 1",
    buttonLabel: "",
    href: "",
    imageFit: "fit-blur",
    focalPointX: 50,
    focalPointY: 50,
    mobileImageUrl: "",
    backgroundColor: "",
    openInNewTab: false,
    enabled: true,
    order: 1,
    updatedAt: "2026-09-03T00:00:00.000Z"
  }
];

describe("PublicHomeCarousel accessibility geometry", () => {
  it("keeps visually hidden instructions at pixel dimensions", () => {
    const { container } = render(<PublicHomeCarousel slides={slides} />);
    const carousel = container.querySelector('[data-public-home-carousel="true"]');
    const instructionsId = carousel?.getAttribute("aria-describedby");
    const instructions = instructionsId ? document.getElementById(instructionsId) : null;

    expect(instructions).not.toBeNull();
    expect(instructions).toHaveStyle({
      width: "1px",
      height: "1px",
      margin: "-1px"
    });
  });
});
