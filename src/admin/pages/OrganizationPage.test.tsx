import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminStaleRevisionError } from "../../features/admin-write/errors";
import type { OrganizationUnitListRow } from "../../features/organization-admin/api";
import OrganizationPage, { type OrganizationManagementView } from "./OrganizationPage";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";

const auth = vi.hoisted(() => ({ capabilities: ["organization.read"] as string[] }));
const api = vi.hoisted(() => ({
  getCollection: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn()
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => ({ capabilities: auth.capabilities })
}));
vi.mock("../../features/organization-admin/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/organization-admin/api")>()),
  getOrganizationCollection: api.getCollection,
  createOrganizationRecord: api.create,
  updateOrganizationRecord: api.update,
  deleteOrganizationRecord: api.remove
}));
vi.mock("../../utils/swal", () => ({
  appSwal: { fire: vi.fn(async () => ({ isConfirmed: true })), close: vi.fn(async () => {}) },
  showBlockingLoading: vi.fn(),
  showSuccessResult: vi.fn(async () => {}),
  showErrorResult: vi.fn(async () => {})
}));

const existing: OrganizationUnitListRow = {
  content_id: "unit-1",
  parent_content_id: null,
  unit_kind: "division",
  sort_order: 0,
  slug: "division-1",
  title: "ฝ่ายบริหารทรัพยากร",
  summary: "",
  status: "draft",
  publish_at: "",
  unpublish_at: "",
  content_revision: 2,
  unit_revision: 2
};

function renderPage(view: OrganizationManagementView = "legacy") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationPage view={view} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.capabilities = ["organization.read"];
  api.getCollection.mockImplementation(async (collection: string) => ({
    items: collection === "units" ? [existing] : [],
    nextOffset: null,
    maximumItems: 100,
    generatedAt: ""
  }));
  api.create.mockResolvedValue({ item: {} });
  api.update.mockResolvedValue({ item: {} });
  api.remove.mockResolvedValue({ id: "unit-1", deleted: true });
});

describe("Phase 4 Organization Admin list/editor", () => {
  it.each([
    ["overview", "ภาพรวมองค์กร", "CorporateFareOutlinedIcon", "สรุปจำนวนหน่วยงาน บุคลากร ตำแหน่ง และหน้าที่ที่บันทึกในระบบ"],
    ["units", "จัดการหน่วยงาน", "BusinessOutlinedIcon", "เพิ่มหรือแก้ไขหน่วยงานและลำดับสังกัด โดยไม่กระทบทะเบียนบุคลากร"],
    ["personnel", "ทะเบียนบุคลากร", "BadgeOutlinedIcon", "จัดการข้อมูลบุคลากรส่วนกลาง เพื่อใช้ร่วมกันได้ในหลายตำแหน่ง"],
    ["positions", "จัดการตำแหน่ง", "WorkOutlineOutlinedIcon", "เลือกหน่วยงานเพื่อเพิ่ม แก้ไข และจัดลำดับตำแหน่ง"],
    ["assignments", "มอบหมายหน้าที่", "AssignmentIndOutlinedIcon", "เชื่อมบุคลากรกับตำแหน่งและระบุหน้าที่ โดยไม่สร้างทะเบียนซ้ำ"],
    ["charts", "จัดผังองค์กร", "HubOutlinedIcon", "เลือกหน่วยงาน ตรวจตัวอย่าง และปรับระดับหรือสายบังคับบัญชาก่อนบันทึก"]
  ] as const)("uses the appropriate heading and contextual guidance for %s", (view, title, icon, guidance) => {
    renderPage(view);
    const heading = screen.getByRole("heading", { name: title, level: 1 });
    const headingRow = heading.parentElement;
    expect(headingRow).not.toBeNull();
    expect(within(headingRow as HTMLElement).getByTestId(icon)).toBeInTheDocument();
    expect(within(headingRow as HTMLElement).queryByTestId("AccountTreeOutlinedIcon")).not.toBeInTheDocument();
    expect(screen.getByText(guidance)).toBeInTheDocument();
  });

  it("searches all organization units on the server beyond the initially loaded page", async () => {
    api.getCollection.mockImplementation(
      async (collection: string, _limit: number, _offset = 0, options?: { search?: string }) => ({
        items:
          collection === "units" && options?.search === "การเงิน"
            ? [{ ...existing, content_id: "unit-140", title: "งานการเงิน", slug: "finance" }]
            : collection === "units"
              ? [existing]
              : [],
        total: 141,
        nextOffset: null,
        maximumItems: 100,
        generatedAt: ""
      })
    );
    renderPage("units");
    fireEvent.change(screen.getByRole("textbox", { name: "ค้นหาชื่อ, Slug หรือประเภทหน่วยงาน" }), {
      target: { value: "การเงิน" }
    });
    expect(await screen.findByText("งานการเงิน")).toBeInTheDocument();
    expect(api.getCollection).toHaveBeenCalledWith("units", 100, 0, { includeTotal: true, search: "การเงิน" });
    expect(screen.queryByText("ฝ่ายบริหารทรัพยากร")).not.toBeInTheDocument();
  });

  it("displays organizational titles but hides all mutations from read-only users", async () => {
    renderPage();
    expect(await screen.findByRole("treeitem", { name: "ฝ่ายบริหารทรัพยากร" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มหน่วยงาน" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ลบ" })).not.toBeInTheDocument();
  });

  it("loads subsequent unit pages instead of hiding entries after the first 100", async () => {
    api.getCollection.mockImplementation(async (collection: string, _limit: number, offset = 0) => ({
      items:
        collection !== "units"
          ? []
          : offset === 0
            ? [existing]
            : [{ ...existing, content_id: "unit-2", slug: "work-admin", title: "งานธุรการ" }],
      nextOffset: collection === "units" && offset === 0 ? 1 : null,
      maximumItems: 100,
      generatedAt: ""
    }));
    renderPage();
    expect(await screen.findByRole("treeitem", { name: "ฝ่ายบริหารทรัพยากร" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "โหลดหน่วยงานเพิ่มเติม" }));
    expect(await screen.findByRole("treeitem", { name: "งานธุรการ" })).toBeInTheDocument();
    expect(api.getCollection).toHaveBeenCalledWith("units", 100, 1);
    expect(screen.queryByRole("button", { name: "โหลดหน่วยงานเพิ่มเติม" })).not.toBeInTheDocument();
  });

  it("creates a unit from the isolated form with validated fields", async () => {
    auth.capabilities = ["organization.read", "organization.manage"];
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: "เพิ่มหน่วยงาน" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มหน่วยงาน" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" }), {
      target: { value: "งานพัสดุ" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Slug" }), {
      target: { value: "work-procurement" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกหน่วยงาน" }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        "units",
        expect.objectContaining({
          title: "งานพัสดุ",
          slug: "work-procurement",
          parentContentId: null,
          status: "draft"
        })
      )
    );
    expect(api.update).not.toHaveBeenCalled();
  });

  it("starts a new unit after its siblings and labels loaded units with one-based ranks", async () => {
    auth.capabilities = ["organization.read", "organization.manage"];
    api.getCollection.mockImplementation(async (collection: string) => ({
      items:
        collection === "units"
          ? [existing, { ...existing, content_id: "unit-2", slug: "division-2", title: "ฝ่ายวิชาการ", sort_order: 4 }]
          : [],
      nextOffset: null,
      maximumItems: 100,
      generatedAt: ""
    }));
    renderPage();
    expect(await screen.findByText(/division-1 · อันดับ 1/)).toBeInTheDocument();
    expect(screen.getByText(/division-2 · อันดับ 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มหน่วยงาน" }));
    fireEvent.click(screen.getByText("ตั้งค่าลำดับด้วยตัวเลข (ขั้นสูง)"));
    expect(screen.getByRole("spinbutton", { name: "ลำดับแสดงผล" })).toHaveValue(5);
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" }), {
      target: { value: "งานใหม่" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Slug" }), {
      target: { value: "new-work" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกหน่วยงาน" }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        "units",
        expect.objectContaining({ autoSortOrder: true, sortOrder: undefined })
      )
    );
  });

  it("permits creating the next unit even while more than 100 units remain on later pages", async () => {
    auth.capabilities = ["organization.read", "organization.manage"];
    api.getCollection.mockImplementation(async (collection: string) => ({
      items: collection === "units" ? [existing] : [],
      nextOffset: collection === "units" ? 100 : null,
      maximumItems: 100,
      generatedAt: ""
    }));
    renderPage("units");
    const add = await screen.findByRole("button", { name: "เพิ่มหน่วยงาน" });
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" }), {
      target: { value: "หน่วยงานใหม่เกิน 100" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Slug" }), {
      target: { value: "new-after-hundred" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกหน่วยงาน" }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        "units",
        expect.objectContaining({ autoSortOrder: true, sortOrder: undefined })
      )
    );
  });

  it("offers a server-search parent unit beyond the initial page when editing", async () => {
    auth.capabilities = ["organization.read", "organization.manage"];
    api.getCollection.mockImplementation(
      async (collection: string, _limit: number, _offset = 0, options?: { search?: string }) => ({
        items:
          collection === "units" && options?.search === "ฝ่ายวิชาการ"
            ? [{ ...existing, content_id: "unit-140", title: "ฝ่ายวิชาการ", slug: "academic" }]
            : collection === "units"
              ? [existing]
              : [],
        nextOffset: null,
        maximumItems: 100,
        total: 142,
        generatedAt: ""
      })
    );
    renderPage("units");
    fireEvent.click(await screen.findByRole("button", { name: "แก้ไข" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ค้นหาหน่วยงานแม่" }), {
      target: { value: "ฝ่ายวิชาการ" }
    });
    await waitFor(() =>
      expect(api.getCollection).toHaveBeenCalledWith("units", 25, 0, {
        includeTotal: true,
        search: "ฝ่ายวิชาการ"
      })
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "หน่วยงานแม่" }));
    fireEvent.click(await screen.findByRole("option", { name: "ฝ่ายวิชาการ" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกหน่วยงาน" }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        "units",
        "unit-1",
        2,
        expect.objectContaining({ parentContentId: "unit-140" })
      )
    );
  });

  it("only deletes units after user confirmation with the exact server revision", async () => {
    auth.capabilities = ["organization.read", "organization.manage"];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "ลบ" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("units", "unit-1", 2));
  });

  it("fails closed and requests fresh data when someone else changed a revision", async () => {
    auth.capabilities = ["organization.read", "organization.manage"];
    api.update.mockRejectedValueOnce(new AdminStaleRevisionError());
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "แก้ไข" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" }), {
      target: { value: "ฝ่ายบริหารทรัพยากร (แก้ไข)" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกหน่วยงาน" }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        "units",
        "unit-1",
        2,
        expect.objectContaining({ title: "ฝ่ายบริหารทรัพยากร (แก้ไข)" })
      )
    );
    expect(await screen.findByText(/ข้อมูลหน่วยงานถูกเปลี่ยนโดยผู้อื่น/)).toBeInTheDocument();
  });
  it("shows blocking feedback followed by an acknowledged unit-save success", async () => {
    auth.capabilities = ["organization.read", "organization.manage"];
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: "เพิ่มหน่วยงาน" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มหน่วยงาน" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" }), {
      target: { value: "งานทดสอบการบันทึก" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Slug" }), {
      target: { value: "write-feedback" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกหน่วยงาน" }));
    await waitFor(() => expect(showBlockingLoading).toHaveBeenCalledWith("กำลังบันทึกหน่วยงาน"));
    await waitFor(() => expect(showSuccessResult).toHaveBeenCalledWith("บันทึกหน่วยงานสำเร็จ", expect.any(String)));
    expect(appSwal.close).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "ชื่อหน่วยงาน" })).not.toBeInTheDocument());
  });

  it("reports a failed save and retains the entered unit form for retry", async () => {
    auth.capabilities = ["organization.read", "organization.manage"];
    api.create.mockRejectedValueOnce(new Error("server unavailable"));
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: "เพิ่มหน่วยงาน" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มหน่วยงาน" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" }), {
      target: { value: "งานไม่ควรหาย" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Slug" }), {
      target: { value: "keep-draft" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกหน่วยงาน" }));
    await waitFor(() =>
      expect(showErrorResult).toHaveBeenCalledWith("บันทึกหน่วยงานไม่สำเร็จ", expect.any(Error), "กรุณาลองอีกครั้ง")
    );
    expect(screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" })).toHaveValue("งานไม่ควรหาย");
  });
});
