import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminStaleRevisionError } from "../../features/admin-write/errors";
import type { OrganizationPositionRow, OrganizationUnitListRow } from "../../features/organization-admin";
import OrganizationChartLayoutEditor from "./OrganizationChartLayoutEditor";
import { showErrorResult, showSuccessResult } from "../../utils/swal";

const api = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../../features/organization-admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/organization-admin")>()),
  updateOrganizationRecord: api.update
}));
vi.mock("../../public/components/OrganizationChartView", () => ({
  default: () => <div data-testid="chart-preview" />
}));
vi.mock("../../utils/swal", () => ({
  appSwal: { close: vi.fn(async () => {}) },
  showBlockingLoading: vi.fn(),
  showErrorResult: vi.fn(async () => {}),
  showSuccessResult: vi.fn(async () => {})
}));

const unit: OrganizationUnitListRow = {
  content_id: "unit-1",
  parent_content_id: null,
  unit_kind: "work",
  sort_order: 0,
  slug: "unit-1",
  title: "งานธุรการ",
  summary: "",
  status: "draft",
  publish_at: "",
  unpublish_at: "",
  content_revision: 3,
  unit_revision: 3,
  chart_mode: "rows",
  chart_layout: JSON.stringify({
    "position-1": { level: 1, row: 1, order: 0, parentPositionId: null }
  })
};
const position: OrganizationPositionRow = {
  id: "position-1",
  unit_content_id: "unit-1",
  title: "หัวหน้างาน",
  group_label: "",
  group_sort_order: 0,
  sort_order: 0,
  display_style: "default",
  occupant_limit: null,
  revision: 0
};

function show(onSaved: () => Promise<void>, canManage = true) {
  return render(
    <OrganizationChartLayoutEditor
      unit={unit}
      positions={[position]}
      assignments={[]}
      personnel={[]}
      canManage={canManage}
      allPositionsLoaded
      onSaved={onSaved}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.update.mockResolvedValue({ item: {} });
});

describe("Organization Chart layout audited save feedback", () => {
  it("reports committed saves as successful even when revision refresh fails", async () => {
    const onSaved = vi.fn().mockRejectedValue(new Error("refresh unavailable"));
    show(onSaved);
    fireEvent.click(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith("units", "unit-1", 3, {
        chartMode: "rows",
        chartLayout: { "position-1": { level: 1, row: 1, order: 0, parentPositionId: null } }
      })
    );
    await waitFor(() => expect(showSuccessResult).toHaveBeenCalledWith("บันทึกผังองค์กรสำเร็จ"));
    expect(screen.getByRole("alert")).toHaveTextContent("บันทึกผังองค์กรแล้ว แต่โหลด Revision ล่าสุดไม่สำเร็จ");
    expect(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" })).toBeDisabled();
    expect(showErrorResult).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("keeps the editor retryable when the actual write fails", async () => {
    api.update.mockRejectedValueOnce(new Error("stale revision"));
    const onSaved = vi.fn();
    show(onSaved);
    fireEvent.click(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" }));
    await waitFor(() =>
      expect(showErrorResult).toHaveBeenCalledWith(
        "บันทึกผังองค์กรไม่สำเร็จ",
        expect.any(Error),
        "โหลดหน่วยงานล่าสุดแล้วลองอีกครั้ง"
      )
    );
    expect(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" })).toBeEnabled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(showSuccessResult).not.toHaveBeenCalled();
  });

  it("prevents a read-only user from writing layouts", () => {
    show(vi.fn(), false);
    expect(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" })).toBeDisabled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("distinguishes a saved A/B layout from pending edits and identifies the unit Revision", () => {
    show(vi.fn());
    expect(screen.getByText("บันทึกแล้ว: แบบ A")).toBeInTheDocument();
    expect(screen.getByText("Unit Revision: 3")).toBeInTheDocument();
    expect(screen.getByText("ตรงกับข้อมูลที่บันทึก")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "ระดับชั้น" }), { target: { value: "2" } });
    expect(screen.getByText("มีการแก้ไขที่ยังไม่บันทึก")).toBeInTheDocument();
    expect(screen.getByText("มีการเปลี่ยนแปลงผังที่ยังไม่ได้บันทึก")).toBeInTheDocument();
  });

  it("previews legacy Cards as visible personnel/position cards rather than an empty panel", () => {
    render(
      <OrganizationChartLayoutEditor
        unit={{ ...unit, chart_mode: "cards" }}
        positions={[position]}
        assignments={[]}
        personnel={[]}
        canManage
        allPositionsLoaded
        onSaved={vi.fn()}
      />
    );
    const preview = screen.getByRole("region", { name: "ตัวอย่างผังองค์กรแนวนอน ก่อนบันทึก" });
    const rail = within(preview).getByRole("region", { name: "ตำแหน่งของงานธุรการ เลื่อนแนวนอนได้" });
    expect(preview).toHaveAttribute("data-organization-preview", "horizontal");
    expect(rail).toHaveAttribute("tabindex", "0");
    expect(within(rail).getByText("หัวหน้างาน")).toBeInTheDocument();
    expect(within(rail).getByText("ยังไม่ได้ระบุผู้ดำรงตำแหน่ง")).toBeInTheDocument();
  });

  it("renders the horizontal preview before editing controls and updates the pending layout immediately", () => {
    render(
      <OrganizationChartLayoutEditor
        unit={unit}
        positions={[position, { ...position, id: "position-2", title: "รองหัวหน้างาน", sort_order: 1 }]}
        assignments={[]}
        personnel={[]}
        canManage
        allPositionsLoaded
        onSaved={vi.fn()}
      />
    );
    const preview = screen.getByRole("region", { name: "ตัวอย่างผังองค์กรแนวนอน ก่อนบันทึก" });
    const rail = within(preview).getByRole("region", { name: "ภาพรวมตำแหน่งแนวนอน เลื่อนดูได้" });
    expect(
      preview.compareDocumentPosition(screen.getAllByRole("spinbutton", { name: "ระดับชั้น" })[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      within(rail)
        .getAllByText(/หัวหน้างาน/)
        .map((node) => node.textContent)
    ).toEqual(["หัวหน้างาน", "รองหัวหน้างาน"]);
    fireEvent.change(screen.getAllByRole("spinbutton", { name: "ระดับชั้น" })[1], { target: { value: "2" } });
    expect(within(rail).getByText("ระดับ 2 · แถว 1")).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("keeps the horizontal preview available while using tree mode before saving", () => {
    render(
      <OrganizationChartLayoutEditor
        unit={{ ...unit, chart_mode: "tree" }}
        positions={[position]}
        assignments={[]}
        personnel={[]}
        canManage
        allPositionsLoaded
        onSaved={vi.fn()}
      />
    );
    expect(screen.getByRole("region", { name: "ภาพรวมตำแหน่งแนวนอน เลื่อนดูได้" })).toBeInTheDocument();
    expect(screen.getByTestId("chart-preview")).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("blocks saving an inconsistent content/unit revision before calling the Worker", () => {
    render(
      <OrganizationChartLayoutEditor
        unit={{ ...unit, content_revision: 4, unit_revision: 3 }}
        positions={[position]}
        assignments={[]}
        personnel={[]}
        canManage
        allPositionsLoaded
        onSaved={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Revision ของหน่วยงานไม่ตรงกัน");
    expect(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" })).toBeDisabled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("rejects a 409 stale-revision race and prevents retrying the old revision", async () => {
    api.update.mockRejectedValueOnce(new AdminStaleRevisionError());
    const onSaved = vi.fn();
    show(onSaved);
    fireEvent.click(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Revision เปลี่ยนแล้ว"));
    expect(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" }));
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it("keeps a committed layout locked until the next Revision is loaded, even when refresh succeeds", async () => {
    const onSaved = vi.fn().mockResolvedValue(undefined);
    show(onSaved);
    fireEvent.click(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" }));
    await waitFor(() => expect(showSuccessResult).toHaveBeenCalledWith("บันทึกผังองค์กรสำเร็จ"));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" })).toBeDisabled();
    expect(screen.getByText("ตรงกับข้อมูลที่บันทึก")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" }));
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it("does not allow a read-only editor to switch the saved A/B/Cards selection", () => {
    show(vi.fn(), false);
    expect(screen.getByRole("combobox", { name: "รูปแบบผัง" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("spinbutton", { name: "ระดับชั้น" })).toBeDisabled();
    expect(api.update).not.toHaveBeenCalled();
  });
});
