import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CarouselImageStage from "../shared/components/CarouselImageStage";
import type { CarouselSlide } from "../types";

function createSlide(overrides: Partial<CarouselSlide> = {}): CarouselSlide {
  return {
    id: "slide-1",
    title: "สไลด์ทดสอบ",
    subtitle: "",
    chip: "",
    imageUrl: "https://example.edu/desktop.jpg",
    imageAlt: "ภาพสไลด์ทดสอบ",
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
    updatedAt: "2026-07-15T00:00:00.000Z",
    ...overrides
  };
}

describe("CarouselImageStage", () => {
  it("renders fit-blur with a blurred background layer and a contained main image", () => {
    const { container } = render(
      <CarouselImageStage slide={createSlide()} alt="ภาพสไลด์ทดสอบ" stageSx={{ minHeight: 220 }} />
    );

    const stage = container.querySelector('[data-carousel-image-stage="true"]');
    const background = container.querySelector('[data-carousel-image-layer="background"]');
    const mainImage = screen.getByRole("img", { name: "ภาพสไลด์ทดสอบ" });

    expect(stage).toHaveAttribute("data-carousel-image-fit", "fit-blur");
    expect(background).toBeInTheDocument();
    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(mainImage).toHaveAttribute("data-carousel-object-fit", "contain");
    expect(mainImage).toHaveAttribute("data-carousel-object-position", "50% 50%");
  });

  it("renders fill with cover and the configured focal point without a blurred layer", () => {
    const { container } = render(
      <CarouselImageStage
        slide={createSlide({ imageFit: "fill", focalPointX: 25.5, focalPointY: 10 })}
        alt="ภาพแบบเต็มพื้นที่"
        stageSx={{ minHeight: 220 }}
      />
    );

    const mainImage = screen.getByRole("img", { name: "ภาพแบบเต็มพื้นที่" });

    expect(container.querySelector('[data-carousel-image-layer="background"]')).not.toBeInTheDocument();
    expect(mainImage).toHaveAttribute("data-carousel-object-fit", "cover");
    expect(mainImage).toHaveAttribute("data-carousel-object-position", "25.5% 10%");
  });

  it("renders fit as a contained image without the blurred background layer", () => {
    const { container } = render(
      <CarouselImageStage
        slide={createSlide({ imageFit: "fit", backgroundColor: "#123456" })}
        alt="ภาพแสดงครบ"
        stageSx={{ minHeight: 220 }}
      />
    );

    const stage = container.querySelector('[data-carousel-image-stage="true"]');
    const mainImage = screen.getByRole("img", { name: "ภาพแสดงครบ" });

    expect(stage).toHaveAttribute("data-carousel-background-color", "#123456");
    expect(container.querySelector('[data-carousel-image-layer="background"]')).not.toBeInTheDocument();
    expect(mainImage).toHaveAttribute("data-carousel-object-fit", "contain");
  });

  it("normalizes a Google Drive desktop URL for src and srcset", () => {
    render(
      <CarouselImageStage
        slide={createSlide({
          imageUrl: "https://drive.google.com/file/d/RCAT_carousel-2026_ABC123/view?usp=sharing",
          imageFit: "fill"
        })}
        alt="ภาพจากไดรฟ์"
        loading="eager"
        fetchPriority="high"
        stageSx={{ minHeight: 220 }}
      />
    );

    const mainImage = screen.getByRole("img", { name: "ภาพจากไดรฟ์" });

    expect(mainImage).toHaveAttribute(
      "src",
      "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w1600"
    );
    expect(mainImage).toHaveAttribute(
      "srcset",
      [
        "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w640 640w",
        "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w900 900w",
        "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w1200 1200w",
        "https://drive.google.com/thumbnail?id=RCAT_carousel-2026_ABC123&sz=w1600 1600w"
      ].join(", ")
    );
    expect(mainImage).toHaveAttribute("loading", "eager");
    expect(mainImage).toHaveAttribute("fetchpriority", "high");
  });

  it("creates a responsive mobile source without replacing the desktop fallback", () => {
    const { container } = render(
      <CarouselImageStage
        slide={createSlide({
          imageUrl: "https://example.edu/desktop.jpg",
          mobileImageUrl: "https://drive.google.com/file/d/RCAT_mobile_ABC123/view?usp=sharing"
        })}
        alt="ภาพ responsive"
        stageSx={{ minHeight: 220 }}
      />
    );

    const source = container.querySelector('source[media="(max-width: 600px)"]');
    const mainImage = screen.getByRole("img", { name: "ภาพ responsive" });

    expect(source).toHaveAttribute(
      "srcset",
      [
        "https://drive.google.com/thumbnail?id=RCAT_mobile_ABC123&sz=w640 640w",
        "https://drive.google.com/thumbnail?id=RCAT_mobile_ABC123&sz=w900 900w",
        "https://drive.google.com/thumbnail?id=RCAT_mobile_ABC123&sz=w1200 1200w",
        "https://drive.google.com/thumbnail?id=RCAT_mobile_ABC123&sz=w1600 1600w"
      ].join(", ")
    );
    expect(mainImage).toHaveAttribute("src", "https://example.edu/desktop.jpg");
  });

  it("shows an accessible fallback when the URL is invalid", () => {
    render(
      <CarouselImageStage
        slide={createSlide({ imageUrl: "javascript:alert(1)", mobileImageUrl: "" })}
        alt="ภาพไม่ปลอดภัย"
        emptyLabel="ไม่สามารถแสดงภาพได้"
        stageSx={{ minHeight: 220 }}
      />
    );

    expect(screen.getByRole("img", { name: "ภาพไม่ปลอดภัย" })).toHaveAttribute("data-carousel-image-fallback", "true");
    expect(screen.getByText("ไม่สามารถแสดงภาพได้")).toBeInTheDocument();
  });

  it("replaces a failed main image with the accessible fallback", () => {
    render(
      <CarouselImageStage
        slide={createSlide({ imageFit: "fill" })}
        alt="ภาพโหลดไม่สำเร็จ"
        emptyLabel="โหลดรูปภาพไม่สำเร็จ"
        stageSx={{ minHeight: 220 }}
      />
    );

    const mainImage = screen.getByRole("img", { name: "ภาพโหลดไม่สำเร็จ" });
    fireEvent.error(mainImage);

    expect(screen.getByRole("img", { name: "ภาพโหลดไม่สำเร็จ" })).toHaveAttribute(
      "data-carousel-image-fallback",
      "true"
    );
    expect(screen.getByText("โหลดรูปภาพไม่สำเร็จ")).toBeInTheDocument();
  });
});
