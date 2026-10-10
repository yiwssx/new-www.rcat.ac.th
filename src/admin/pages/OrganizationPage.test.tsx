import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminStaleRevisionError } from "../../features/admin-write/errors";
import type { OrganizationUnitListRow } from "../../features/organization-admin/api";
import OrganizationPage from "./OrganizationPage";

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
  appSwal: { fire: vi.fn(async () => ({ isConfirmed: true })) }
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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationPage />
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
  it("displays organizational titles but hides all mutations from read-only users", async () => {
    renderPage();
    expect(await screen.findByText("ฝ่ายบริหารทรัพยากร")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มหน่วยงาน" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ลบ" })).not.toBeInTheDocument();
  });

  it("creates a unit from the isolated form with validated fields", async () => {
    auth.capabilities = ["organization.read", "organization.manage"];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "เพิ่มหน่วยงาน" }));
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
});
