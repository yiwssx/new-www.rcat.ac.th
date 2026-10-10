import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminStaleRevisionError } from "../../features/admin-write/errors";
import type { OrganizationUnitListRow } from "../../features/organization-admin/api";
import OrganizationBuilder from "./OrganizationBuilder";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn()
}));
vi.mock("../../features/organization-admin/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/organization-admin/api")>()),
  getOrganizationCollection: api.list,
  createOrganizationRecord: api.create,
  updateOrganizationRecord: api.update,
  deleteOrganizationRecord: api.remove
}));
vi.mock("../../utils/swal", () => ({
  appSwal: { fire: vi.fn(async () => ({ isConfirmed: true })) }
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

function setup(canManage: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationBuilder units={units} allUnitsLoaded canManage={canManage} />
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
});

describe("Phase 6 accessible Organization builder", () => {
  it("shows a nested unit navigator and position details to read-only editors without writes", async () => {
    setup(false);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    expect(await screen.findByText("หัวหน้างาน")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "โครงสร้างหน่วยงาน" })).toBeInTheDocument();
    expect(screen.getByRole("tree", { name: "โครงสร้างหน่วยงาน" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มตำแหน่ง" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "มอบหมายบุคลากร" })).not.toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("creates a unit-scoped position through the dedicated audited facade", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    fireEvent.click(await screen.findByRole("button", { name: "เพิ่มตำแหน่ง" }));
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

  it("assigns an existing canonical person with audited position input and no duplicate profile", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    fireEvent.click(await screen.findByRole("button", { name: "มอบหมายบุคลากร" }));
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

  it("does not offer assignment period inputs and allows explicit manual visibility", async () => {
    setup(true);
    fireEvent.click(screen.getByText("งานสารบรรณ"));
    fireEvent.click(await screen.findByRole("button", { name: "มอบหมายบุคลากร" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "มอบหมายบุคลากร" }));
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
});
