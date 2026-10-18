import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminStaleRevisionError } from "../../features/admin-write/errors";
import type { OrganizationUnitListRow } from "../../features/organization-admin/api";
import OrganizationBuilder from "./OrganizationBuilder";
import { showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  transfer: vi.fn()
}));
vi.mock("../../features/organization-admin/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/organization-admin/api")>()),
  getOrganizationCollection: api.list,
  createOrganizationRecord: api.create,
  updateOrganizationRecord: api.update,
  deleteOrganizationRecord: api.remove,
  transferOrganizationAssignment: api.transfer
}));
vi.mock("../../utils/swal", () => ({
  appSwal: { fire: vi.fn(async () => ({ isConfirmed: true })), close: vi.fn(async () => {}) },
  showBlockingLoading: vi.fn(),
  showSuccessResult: vi.fn(async () => {}),
  showErrorResult: vi.fn(async () => {})
}));

const units: OrganizationUnitListRow[] = [
  {
    content_id: "division-1",
    parent_content_id: null,
    unit_kind: "division",
    sort_order: 0,
    slug: "division-1",
    title: "ฝ่ายบริหาร",
    summary: "",
    status: "draft",
    publish_at: "",
    unpublish_at: "",
    content_revision: 0,
    unit_revision: 0
  },
  {
    content_id: "work-1",
    parent_content_id: "division-1",
    unit_kind: "work",
    sort_order: 0,
    slug: "work-1",
    title: "งานสารบรรณ",
    summary: "",
    status: "draft",
    publish_at: "",
    unpublish_at: "",
    content_revision: 0,
    unit_revision: 0
  }
];

function setup(canManage: boolean, view: "legacy" | "positions" | "assignments" | "charts" = "legacy") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationBuilder units={units} allUnitsLoaded canManage={canManage} view={view} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockImplementation(async (collection: string) => ({
    items:
      collection === "positions"
        ? [
            {
              id: "position-1",
              unit_content_id: "work-1",
              title: "หัวหน้างาน",
              group_label: "ผู้บริหาร",
              group_sort_order: 0,
              sort_order: 0,
              display_style: "default",
              occupant_limit: 1,
              revision: 0
            }
          ]
        : collection === "personnel"
          ? [
              {
                id: "person-1",
                display_name: "บุคลากรทดสอบ",
                active: 1,
                revision: 0
              }
            ]
          : [],
    nextOffset: null,
    maximumItems: 100,
    generatedAt: ""
  }));
  api.create.mockResolvedValue({ item: {} });
  api.update.mockResolvedValue({ item: {} });
  api.remove.mockResolvedValue({ deleted: true });
  api.transfer.mockResolvedValue({ item: {} });
});

describe("Phase 6 accessible Organization builder", () => {
  it("keeps the positions submenu independent of assignment and personnel list queries", async () => {
    setup(false, "positions");
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    expect(await screen.findByText("หัวหน้างาน")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith("positions", 100, 0, {
      includeTotal: true,
      unitContentId: "work-1"
    });
    expect(api.list.mock.calls.some(([collection]) => collection === "assignments" || collection === "personnel")).toBe(
      false
    );
  });

  it("keeps the chart submenu focused on the layout editor without duplicate duty cards", async () => {
    setup(false, "charts");
    expect(screen.getByText("ตำแหน่งใน ฝ่ายบริหาร")).toBeInTheDocument();
    expect(screen.queryByRole("tree", { name: "โครงสร้างหน่วยงาน" })).not.toBeInTheDocument();
    const showNavigator = screen.getByRole("button", { name: "เปิดรายการลำดับชั้น (สำหรับเลือกหน่วยงาน)" });
    expect(showNavigator).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(showNavigator);
    expect(screen.getByRole("tree", { name: "โครงสร้างหน่วยงาน" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ซ่อนรายการลำดับชั้น" }));
    expect(screen.queryByRole("tree", { name: "โครงสร้างหน่วยงาน" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /งานสารบรรณ/ }));
    expect(await screen.findByText("ตำแหน่งใน งานสารบรรณ")).toBeInTheDocument();
    expect(await screen.findByText("จัดระดับและผังบุคลากร")).toBeInTheDocument();
    expect(screen.queryByText("อันดับ 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไขตำแหน่ง" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "มอบหมายบุคลากร" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith("positions", 100, 0, {
        includeTotal: true,
        unitContentId: "work-1"
      })
    );
  });

  it("keeps the vertical tree visible on the positions and legacy pages", () => {
    setup(false, "positions");
    expect(screen.getByRole("tree", { name: "โครงสร้างหน่วยงาน" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /เปิดรายการลำดับชั้น/ })).not.toBeInTheDocument();
  });

  it("shows a nested unit navigator and position details to read-only editors without writes", async () => {
    setup(false);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    expect((await screen.findAllByText("หัวหน้างาน")).length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "โครงสร้างหน่วยงาน" })).toBeInTheDocument();
    expect(screen.getByRole("tree", { name: "โครงสร้างหน่วยงาน" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มตำแหน่ง" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "มอบหมายบุคลากร" })).not.toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("saves a unit-specific chart layout with the current unit revision", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    const mode = await screen.findByRole("combobox", { name: "รูปแบบผัง" });
    fireEvent.mouseDown(mode);
    fireEvent.click(await screen.findByRole("option", { name: /แบบ A/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "ระดับชั้น" }), {
      target: { value: "3" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกโครงสร้างผัง" }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        "units",
        "work-1",
        0,
        expect.objectContaining({
          chartMode: "rows",
          chartLayout: expect.objectContaining({
            "position-1": { level: 3, row: 1, order: 0, parentPositionId: null }
          })
        })
      )
    );
  });

  it("enables drag handles only for editable, complete sibling lists", async () => {
    api.list.mockImplementation(async (collection: string) => ({
      items:
        collection === "positions"
          ? [
              {
                id: "p-a",
                unit_content_id: "work-1",
                title: "A",
                group_label: "",
                group_sort_order: 0,
                sort_order: 0,
                display_style: "default",
                occupant_limit: null,
                revision: 0
              },
              {
                id: "p-b",
                unit_content_id: "work-1",
                title: "B",
                group_label: "",
                group_sort_order: 0,
                sort_order: 1,
                display_style: "default",
                occupant_limit: null,
                revision: 0
              }
            ]
          : [],
      nextOffset: null,
      maximumItems: 100,
      generatedAt: ""
    }));
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    expect(await screen.findByRole("button", { name: "ลากจัดลำดับ A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ลากจัดลำดับ B" })).toBeInTheDocument();
  });

  it("lets the only occupant of a position open a safe cross-unit transfer dialog", async () => {
    api.list.mockImplementation(async (collection: string, _limit: number, _offset: number, options?: { unitContentId?: string }) => ({
      items:
        collection === "positions"
          ? options?.unitContentId === "division-1"
            ? [{
                id: "position-target", unit_content_id: "division-1", title: "เจ้าหน้าที่ฝ่าย", group_label: "",
                group_sort_order: 0, sort_order: 0, display_style: "default", occupant_limit: 2, revision: 0
              }]
            : [{
                id: "position-1", unit_content_id: "work-1", title: "เจ้าหน้าที่ประจำงาน", group_label: "",
                group_sort_order: 0, sort_order: 0, display_style: "default", occupant_limit: 1, revision: 4
              }]
          : collection === "assignments"
            ? [{
                id: "assignment-only", personnel_id: "person-1", position_id: "position-1",
                duty_detail: "", sort_order: 0, enabled: 1, revision: 2
              }]
            : collection === "personnel"
              ? [{ id: "person-1", display_name: "บุคลากรคนเดียว", active: 1, revision: 0 }]
              : [],
      nextOffset: null, maximumItems: 100, generatedAt: ""
    }));
    setup(true, "assignments");
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    expect(await screen.findByRole("button", { name: "ลากจัดลำดับ บุคลากรคนเดียว" })).toBeEnabled();
    expect(screen.getByLabelText("วางบุคลากรเพื่อย้ายข้ามตำแหน่งหรือหน่วยงาน")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ย้ายตำแหน่งหรือหน่วยงาน" }));
    expect(screen.getByRole("dialog", { name: "ย้ายบุคลากรข้ามตำแหน่งหรือหน่วยงาน" })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "หน่วยงานปลายทาง" }));
    fireEvent.click(screen.getByRole("option", { name: "ฝ่ายบริหาร" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "ตำแหน่งปลายทาง" })).toBeEnabled());
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "ตำแหน่งปลายทาง" }));
    fireEvent.click(await screen.findByRole("option", { name: "เจ้าหน้าที่ฝ่าย" }));
    fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบและยืนยันการย้าย" }));
    await waitFor(() => {
      expect(api.transfer).toHaveBeenCalledWith("assignment-only", 2, "position-target");
    });
    expect(api.remove).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("creates a unit-scoped position through the dedicated audited facade", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    await waitFor(() => expect(screen.getByRole("button", { name: "เพิ่มตำแหน่ง" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มตำแหน่ง" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อตำแหน่ง" }), {
      target: { value: "ผู้ช่วยหัวหน้างาน" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกตำแหน่ง" }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        "positions",
        expect.objectContaining({
          title: "ผู้ช่วยหัวหน้างาน",
          unitContentId: "work-1",
          occupantLimit: null
        })
      )
    );
  });

  it("uses server-owned append for new grouped positions without trusting partial client order", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    await waitFor(() => expect(screen.getByRole("button", { name: "เพิ่มตำแหน่ง" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มตำแหน่ง" }));
    fireEvent.change(screen.getByRole("textbox", { name: "กลุ่มตำแหน่ง" }), {
      target: { value: "ผู้บริหาร" }
    });
    fireEvent.click(screen.getByText("ตั้งค่าลำดับด้วยตัวเลข (ขั้นสูง)"));
    expect(screen.getByRole("checkbox", { name: "เพิ่มต่อท้ายอัตโนมัติจากข้อมูลบนเซิร์ฟเวอร์" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "ลำดับตำแหน่ง" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อตำแหน่ง" }), {
      target: { value: "รองหัวหน้างาน" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกตำแหน่ง" }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        "positions",
        expect.objectContaining({ autoSortOrder: true, sortOrder: undefined })
      )
    );
  });

  it("assigns an existing canonical person with audited position input and no duplicate profile", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    await waitFor(() => expect(screen.getByRole("button", { name: "มอบหมายบุคลากร" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "มอบหมายบุคลากร" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "บุคลากรจากทะเบียนกลาง" }));
    fireEvent.click(await screen.findByRole("option", { name: "บุคลากรทดสอบ" }));
    fireEvent.change(screen.getByRole("textbox", { name: "รายละเอียดหน้าที่" }), {
      target: { value: "ประสานงานเอกสาร" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกหน้าที่" }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        "assignments",
        expect.objectContaining({
          personnelId: "person-1",
          positionId: "position-1",
          dutyDetail: "ประสานงานเอกสาร",
          enabled: true
        })
      )
    );
    expect(api.create).not.toHaveBeenCalledWith("personnel", expect.anything());
  });

  it("updates a position against the row revision, not an unguarded write", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    fireEvent.click(await screen.findByRole("button", { name: "แก้ไขตำแหน่ง" }));
    fireEvent.click(screen.getByText("ตั้งค่าลำดับด้วยตัวเลข (ขั้นสูง)"));
    fireEvent.change(screen.getByRole("spinbutton", { name: "ลำดับตำแหน่ง" }), {
      target: { value: "2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกตำแหน่ง" }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        "positions",
        "position-1",
        0,
        expect.objectContaining({ sortOrder: 2, unitContentId: "work-1" })
      )
    );
  });

  it("appends assignments on the server instead of relying on loaded occupants", async () => {
    api.list.mockImplementation(async (collection: string) => ({
      items:
        collection === "positions"
          ? [
              {
                id: "position-1",
                unit_content_id: "work-1",
                title: "หัวหน้างาน",
                group_label: "",
                group_sort_order: 0,
                sort_order: 0,
                display_style: "default",
                occupant_limit: null,
                revision: 0
              }
            ]
          : collection === "assignments"
            ? [
                {
                  id: "assignment-1",
                  position_id: "position-1",
                  personnel_id: "person-1",
                  duty_detail: "",
                  sort_order: 3,
                  enabled: 1,
                  revision: 0
                }
              ]
            : [{ id: "person-1", display_name: "บุคลากรทดสอบ", active: 1, revision: 0 }],
      nextOffset: null,
      maximumItems: 100,
      generatedAt: ""
    }));
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    await waitFor(() => expect(screen.getByRole("button", { name: "มอบหมายบุคลากร" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "มอบหมายบุคลากร" }));
    fireEvent.click(screen.getByText("ตั้งค่าลำดับด้วยตัวเลข (ขั้นสูง)"));
    expect(screen.getByRole("checkbox", { name: "เพิ่มต่อท้ายอัตโนมัติจากข้อมูลบนเซิร์ฟเวอร์" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "ลำดับการแสดง" })).toBeDisabled();
  });

  it("does not offer assignment period inputs and allows explicit manual visibility", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    await waitFor(() => expect(screen.getByRole("button", { name: "มอบหมายบุคลากร" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "มอบหมายบุคลากร" }));
    const dialog = screen.getByRole("dialog", { name: "มอบหมายบุคลากร" });
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByLabelText(/เริ่มดำรงหน้าที่|สิ้นสุดหน้าที่|วาระ/)).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "เปิดใช้งานการมอบหมายนี้" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "เปิดใช้งานการมอบหมายนี้" }));
    expect(screen.getByRole("checkbox", { name: "เปิดใช้งานการมอบหมายนี้" })).not.toBeChecked();
  });

  it("exposes assignment to canonical personnel rather than creating a second person", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    await waitFor(() => expect(screen.getByRole("button", { name: "มอบหมายบุคลากร" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "มอบหมายบุคลากร" }));
    expect(screen.getByRole("dialog", { name: "มอบหมายบุคลากร" })).toBeInTheDocument();
    expect(screen.getByText(/บันทึกบุคลากรคนเดิมซ้ำในหลายตำแหน่ง/)).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });
  it("paginates positions explicitly instead of silently hiding items beyond the first page", async () => {
    api.list.mockImplementation(async (collection: string, _limit: number, offset = 0) => ({
      items:
        collection === "positions" && offset > 0
          ? [
              {
                id: "position-2",
                unit_content_id: "work-1",
                title: "เจ้าหน้าที่ประสานงาน",
                group_label: "",
                group_sort_order: 0,
                sort_order: 2,
                display_style: "default",
                occupant_limit: null,
                revision: 0
              }
            ]
          : [],
      nextOffset: collection === "positions" && offset === 0 ? 100 : null,
      maximumItems: 100,
      generatedAt: ""
    }));
    setup(false);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    expect(await screen.findByText(/ยังไม่พบตำแหน่งของหน่วยงานนี้ในรายการที่โหลด/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "โหลดตำแหน่งเพิ่มเติม" }));
    expect(await screen.findByText("เจ้าหน้าที่ประสานงาน")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith("positions", 100, 100);
  });

  it("does not report an empty unit as authoritative when loading positions fails", async () => {
    api.list.mockImplementation(async (collection: string) => {
      if (collection === "positions") throw new Error("temporary database failure");
      return { items: [], nextOffset: null, maximumItems: 100, generatedAt: "" };
    });
    setup(false);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    expect(await screen.findByText(/โหลดข้อมูลตำแหน่ง\/หน้าที่\/บุคลากรไม่สำเร็จ/)).toBeInTheDocument();
    expect(screen.queryByText("ยังไม่มีตำแหน่งในหน่วยงานนี้")).not.toBeInTheDocument();
  });

  it("fails closed on concurrent position changes and refuses an unversioned overwrite", async () => {
    api.update.mockRejectedValueOnce(new AdminStaleRevisionError());
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    fireEvent.click(await screen.findByRole("button", { name: "แก้ไขตำแหน่ง" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อตำแหน่ง" }), {
      target: { value: "หัวหน้างาน (แก้ไข)" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกตำแหน่ง" }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        "positions",
        "position-1",
        0,
        expect.objectContaining({ title: "หัวหน้างาน (แก้ไข)" })
      )
    );
    expect(await screen.findByText(/ตำแหน่งถูกเปลี่ยนแปลงโดยผู้ดูแลอื่น/)).toBeInTheDocument();
  });
  it("confirms a saved position instead of silently closing its editor", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    await waitFor(() => expect(screen.getByRole("button", { name: "เพิ่มตำแหน่ง" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มตำแหน่ง" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อตำแหน่ง" }), {
      target: { value: "ผู้ช่วยหัวหน้างาน" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกตำแหน่ง" }));
    await waitFor(() => expect(showBlockingLoading).toHaveBeenCalledWith("กำลังบันทึกตำแหน่ง"));
    await waitFor(() => expect(showSuccessResult).toHaveBeenCalledWith("บันทึกตำแหน่งสำเร็จ"));
  });

  it("retains position edits after a failed write and reports the failure", async () => {
    api.create.mockRejectedValueOnce(new Error("position rejected"));
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    await waitFor(() => expect(screen.getByRole("button", { name: "เพิ่มตำแหน่ง" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มตำแหน่ง" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อตำแหน่ง" }), {
      target: { value: "ตำแหน่งที่ยังไม่สำเร็จ" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกตำแหน่ง" }));
    await waitFor(() =>
      expect(showErrorResult).toHaveBeenCalledWith("บันทึกตำแหน่งไม่สำเร็จ", expect.any(Error), "กรุณาลองอีกครั้ง")
    );
    expect(screen.getByRole("textbox", { name: "ชื่อตำแหน่ง" })).toHaveValue("ตำแหน่งที่ยังไม่สำเร็จ");
  });
});
