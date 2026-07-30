import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CarouselSlide } from "../../types";
import { CarouselSlidePresentationFields, CarouselSlidePresentationPreview } from "./CarouselSlidePresentationEditor";

const slide: CarouselSlide = {
  id: "slide-1",
  title: "Open house",
  subtitle: "",
  chip: "",
  imageUrl: "https://example.test/desktop.jpg",
  imageAlt: "Open house",
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
  updatedAt: "2026-07-17T00:00:00.000Z"
};

describe("CarouselSlidePresentationEditor", () => {
  it("emits responsive image presentation changes", () => {
    const onChange = vi.fn();

    render(<CarouselSlidePresentationFields slide={slide} disabled={false} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("รูปภาพสำหรับมือถือ URL (ไม่บังคับ)"), {
      target: { value: " https://example.test/mobile.jpg " }
    });
    fireEvent.change(screen.getByLabelText("สีพื้นหลัง"), {
      target: { value: "#123456" }
    });
    fireEvent.change(screen.getByLabelText("ตำแหน่งแนวนอน (%)"), {
      target: { value: "35" }
    });
    fireEvent.click(screen.getByRole("switch", { name: "เปิดลิงก์ในแท็บใหม่" }));

    expect(onChange).toHaveBeenCalledWith("mobileImageUrl", " https://example.test/mobile.jpg ");
    expect(onChange).toHaveBeenCalledWith("backgroundColor", "#123456");
    expect(onChange).toHaveBeenCalledWith("focalPointX", 35);
    expect(onChange).toHaveBeenCalledWith("openInNewTab", true);
  });

  it("shows validation guidance for an invalid background color", () => {
    render(
      <CarouselSlidePresentationFields
        slide={{ ...slide, backgroundColor: "green" }}
        disabled={false}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("กรุณาระบุสีแบบ #RGB หรือ #RRGGBB")).toBeInTheDocument();
    expect(screen.getByLabelText("สีพื้นหลัง")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows the desktop fallback notice in mobile preview", () => {
    render(<CarouselSlidePresentationPreview slide={slide} />);

    fireEvent.click(screen.getByRole("button", { name: "มือถือ" }));

    expect(screen.getByText("ยังไม่ได้กำหนดภาพมือถือ ตัวอย่างนี้จึงใช้ภาพหลัก")).toBeInTheDocument();
  });
});
