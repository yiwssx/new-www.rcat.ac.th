import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminDateTimeField from "./AdminDateTimeField";

describe("AdminDateTimeField", () => {
  it("renders dates explicitly as day/month/year and keeps the canonical local value", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AdminDateTimeField label="วันที่เผยแพร่" value="2026-10-02T06:20" onChange={onChange} />
    );

    const dateInput = screen.getByLabelText("วันที่เผยแพร่ - วันที่ (วัน/เดือน/ปี)");

    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(dateInput).toHaveValue("02/10/2026");
    expect(screen.getAllByText("ชั่วโมง (00–23)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("นาที (00–59)").length).toBeGreaterThan(0);
    expect(screen.queryByText(/\b(?:AM|PM)\b/i)).toBeNull();

    fireEvent.change(dateInput, { target: { value: "16/09/2026" } });

    expect(onChange).toHaveBeenCalledWith("2026-09-16T06:20");
  });

  it("clamps a newly entered date to the configured minimum local time", () => {
    const onChange = vi.fn();
    render(<AdminDateTimeField label="สิ้นสุด" value="" min="2026-09-15T14:30" required onChange={onChange} />);

    const dateInput = screen.getByLabelText("สิ้นสุด - วันที่ (วัน/เดือน/ปี)");
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
