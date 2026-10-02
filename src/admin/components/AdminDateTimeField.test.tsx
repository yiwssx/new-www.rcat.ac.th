import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminDateTimeField from "./AdminDateTimeField";

describe("AdminDateTimeField", () => {
  it("renders dates explicitly as day/month/year and keeps the native picker canonical", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AdminDateTimeField label="วันที่เผยแพร่" value="2026-10-02T06:20" onChange={onChange} />
    );

    const dateInput = screen.getByLabelText("วันที่เผยแพร่ - วันที่ (วัน/เดือน/ปี)");
    const nativeDateInput = container.querySelector('input[type="date"]');

    expect(nativeDateInput).not.toBeNull();
    expect(nativeDateInput).toHaveValue("2026-10-02");
    expect(nativeDateInput).toHaveAttribute("aria-hidden", "true");
    expect(nativeDateInput).toHaveAttribute("tabindex", "-1");
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(dateInput).toHaveValue("02/10/2026");
    expect(screen.getByRole("button", { name: "เลือกวันที่เผยแพร่จากปฏิทิน" })).toBeEnabled();
    expect(screen.getAllByText("ชั่วโมง (00–23)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("นาที (00–59)").length).toBeGreaterThan(0);
    expect(screen.queryByText(/\b(?:AM|PM)\b/i)).toBeNull();

    fireEvent.change(dateInput, { target: { value: "16/09/2026" } });

    expect(onChange).toHaveBeenCalledWith("2026-09-16T06:20");
  });

  it("opens the native calendar and commits a selected date without changing the visible format contract", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AdminDateTimeField label="วันที่เผยแพร่" value="2026-10-02T06:20" onChange={onChange} />
    );
    const nativeDateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    const showPicker = vi.fn();
    Object.defineProperty(nativeDateInput, "showPicker", { configurable: true, value: showPicker });

    fireEvent.click(screen.getByRole("button", { name: "เลือกวันที่เผยแพร่จากปฏิทิน" }));
    expect(showPicker).toHaveBeenCalledTimes(1);

    fireEvent.change(nativeDateInput, { target: { value: "2026-09-16" } });
    expect(onChange).toHaveBeenCalledWith("2026-09-16T06:20");
  });

  it("clamps a newly entered date to the configured minimum local time", () => {
    const onChange = vi.fn();
    render(<AdminDateTimeField label="สิ้นสุด" value="" min="2026-09-15T14:30" required onChange={onChange} />);

    const dateInput = screen.getByPlaceholderText("DD/MM/YYYY");
    fireEvent.change(dateInput, { target: { value: "15/09/2026" } });

    expect(onChange).toHaveBeenCalledWith("2026-09-15T14:30");
  });

  it("rejects an invalid day/month/year date and restores the canonical display on blur", () => {
    const onChange = vi.fn();
    render(<AdminDateTimeField label="วันที่เผยแพร่" value="2026-10-02T06:20" onChange={onChange} />);

    const dateInput = screen.getByLabelText("วันที่เผยแพร่ - วันที่ (วัน/เดือน/ปี)");
    fireEvent.change(dateInput, { target: { value: "31/02/2026" } });

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(dateInput);

    expect(dateInput).toHaveValue("02/10/2026");
  });
});
