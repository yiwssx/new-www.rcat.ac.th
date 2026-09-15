import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminDateTimeField from "./AdminDateTimeField";

describe("AdminDateTimeField", () => {
  it("uses explicit 24-hour controls without a native AM/PM datetime-local input", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AdminDateTimeField label="วันที่เผยแพร่" value="2026-09-15T14:30" onChange={onChange} />
    );

    const dateInput = container.querySelector('input[type="date"]');

    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(dateInput).toHaveValue("2026-09-15");
    expect(screen.getAllByText("ชั่วโมง (00–23)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("นาที (00–59)").length).toBeGreaterThan(0);
    expect(screen.queryByText(/\b(?:AM|PM)\b/i)).toBeNull();

    fireEvent.change(dateInput!, { target: { value: "2026-09-16" } });

    expect(onChange).toHaveBeenCalledWith("2026-09-16T14:30");
  });

  it("clamps a newly selected date to the configured minimum local time", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AdminDateTimeField
        label="สิ้นสุด"
        value=""
        min="2026-09-15T14:30"
        required
        onChange={onChange}
      />
    );

    const dateInput = container.querySelector('input[type="date"]');
    fireEvent.change(dateInput!, { target: { value: "2026-09-15" } });

    expect(onChange).toHaveBeenCalledWith("2026-09-15T14:30");
  });
});
