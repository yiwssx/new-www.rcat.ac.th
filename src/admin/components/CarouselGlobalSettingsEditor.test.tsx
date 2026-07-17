import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HomepageCarouselSettings } from "../../types";
import CarouselGlobalSettingsEditor from "./CarouselGlobalSettingsEditor";

const settings: HomepageCarouselSettings = {
  autoplayEnabled: true,
  autoplayIntervalSeconds: 5,
  showArrows: true,
  showDots: true,
  pauseOnHover: true,
  pauseOnFocus: true,
  transition: "slide"
};

describe("CarouselGlobalSettingsEditor", () => {
  it("emits typed setting changes and protects clean drafts", () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const onSave = vi.fn();

    const { rerender } = render(
      <CarouselGlobalSettingsEditor
        settings={settings}
        disabled={false}
        loading={false}
        saving={false}
        dirty={false}
        onChange={onChange}
        onReset={onReset}
        onSave={onSave}
      />
    );

    expect(screen.getByRole("button", { name: "บันทึกการตั้งค่า" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "คืนค่า" })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "แสดงปุ่มลูกศร" }));
    expect(onChange).toHaveBeenCalledWith("showArrows", false);

    fireEvent.change(screen.getByLabelText("ระยะเวลาเปลี่ยนภาพ (วินาที)"), {
      target: { value: "8" }
    });
    expect(onChange).toHaveBeenCalledWith("autoplayIntervalSeconds", 8);

    rerender(
      <CarouselGlobalSettingsEditor
        settings={{ ...settings, showArrows: false }}
        disabled={false}
        loading={false}
        saving={false}
        dirty
        onChange={onChange}
        onReset={onReset}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "คืนค่า" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกการตั้งค่า" }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("warns when both visible navigation control groups are disabled", () => {
    render(
      <CarouselGlobalSettingsEditor
        settings={{
          ...settings,
          showArrows: false,
          showDots: false
        }}
        disabled={false}
        loading={false}
        saving={false}
        dirty
        onChange={vi.fn()}
        onReset={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText(/ปุ่มลูกศรและจุดนำทางถูกปิดทั้งหมด/)).toBeInTheDocument();
  });
});
