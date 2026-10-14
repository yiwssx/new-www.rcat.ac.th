import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultLeadershipSettings } from "../../../services/siteSettings";
import LeadershipSettingsEditor from "./LeadershipSettingsEditor";

describe("LeadershipSettingsEditor", () => {
  it("renders four canonical deputy slots and preserves partially typed portrait URLs", () => {
    const onChange = vi.fn();
    render(<LeadershipSettingsEditor value={defaultLeadershipSettings} disabled={false} onChange={onChange} />);
    expect(screen.getByText("รองผู้อำนวยการ 1")).toBeInTheDocument();
    expect(screen.getByText("รองผู้อำนวยการ 4")).toBeInTheDocument();
    const inputs = screen.getAllByRole("textbox", { name: "URL รูปภาพผู้บริหาร" });
    expect(inputs).toHaveLength(4);
    fireEvent.change(inputs[0], { target: { value: "https:" } });
    expect(onChange).toHaveBeenCalledWith({
      ...defaultLeadershipSettings,
      deputies: [
        { ...defaultLeadershipSettings.deputies[0], imageUrl: "https:" },
        ...defaultLeadershipSettings.deputies.slice(1)
      ]
    });
  });

  it("honors read-only mode", () => {
    const onChange = vi.fn();
    render(<LeadershipSettingsEditor value={defaultLeadershipSettings} disabled onChange={onChange} />);
    for (const input of screen.getAllByRole("textbox", { name: "URL รูปภาพผู้บริหาร" })) {
      expect(input).toBeDisabled();
    }
    expect(onChange).not.toHaveBeenCalled();
  });
});
