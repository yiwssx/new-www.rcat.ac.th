import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PreviewRevisionAutosaveWorkflowPage from "./PreviewRevisionAutosaveWorkflowPage";

vi.mock("./ContentPage", () => ({ default: () => <div>TEST: content list</div> }));
vi.mock("../components/PreviewRevisionAutosaveWorkflowGuide", () => ({
  default: () => <div>TEST: review guide</div>
}));
vi.mock("../components/EditorialWorkflowPanel", () => ({
  default: () => <div>TEST: editorial workflow</div>
}));
vi.mock("../components/ContentHealthDashboard", () => ({
  default: () => <div>TEST: content health</div>
}));
vi.mock("../components/RevisionHistoryViewer", () => ({
  default: () => <div>TEST: revision history</div>
}));
vi.mock("../components/ContentLifecycleGovernancePanel", () => ({
  default: () => <div>TEST: lifecycle</div>
}));
vi.mock("../components/RevisionComparePanel", () => ({
  default: () => <div>TEST: revision comparison</div>
}));
vi.mock("../components/TaxonomyManagerPanel", () => ({
  default: () => <div>TEST: taxonomy</div>
}));
vi.mock("../components/ContentRedirectManagerPanel", () => ({
  default: () => <div>TEST: redirects</div>
}));

describe("Admin content workspaces", () => {
  it("opens the content list without mounting the eight operational panels", async () => {
    render(<PreviewRevisionAutosaveWorkflowPage />);

    expect(await screen.findByText("TEST: content list")).toBeTruthy();
    expect(screen.queryByText("TEST: editorial workflow")).toBeNull();
    expect(screen.queryByText("TEST: content health")).toBeNull();
    expect(screen.queryByText("TEST: revision history")).toBeNull();
    expect(screen.queryByText("TEST: redirects")).toBeNull();
  });

  it("keeps each legacy tool available without stacking unrelated workspaces", async () => {
    render(<PreviewRevisionAutosaveWorkflowPage />);

    fireEvent.click(screen.getByRole("tab", { name: "การตรวจทาน" }));
    expect(await screen.findByText("TEST: editorial workflow")).toBeTruthy();
    expect(screen.getByText("TEST: review guide")).toBeTruthy();
    expect(screen.queryByText("TEST: content list")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "ประวัติและเวอร์ชัน" }));
    expect(await screen.findByText("TEST: revision history")).toBeTruthy();
    expect(screen.getByText("TEST: revision comparison")).toBeTruthy();
    expect(screen.queryByText("TEST: editorial workflow")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "หมวดหมู่และลิงก์" }));
    expect(await screen.findByText("TEST: taxonomy")).toBeTruthy();
    expect(screen.getByText("TEST: redirects")).toBeTruthy();
    expect(screen.queryByText("TEST: revision history")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "คุณภาพและกำหนดเวลา" }));
    expect(await screen.findByText("TEST: content health")).toBeTruthy();
    expect(screen.getByText("TEST: lifecycle")).toBeTruthy();
    expect(screen.queryByText("TEST: taxonomy")).toBeNull();
  });
});
