import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationPersonnelRow } from "../../features/organization-admin/api";
import OrganizationPersonnelDirectory from "./OrganizationPersonnelDirectory";

const api = vi.hoisted(() => ({
  getCollection: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn()
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

vi.mock("./RichTextMediaPickerDialog", () => ({
  default: ({ onSelect, onClose }: { onSelect: (asset: { id: string; name: string }) => void; onClose: () => void }) => (
    <div role="dialog" aria-label="Media Library test picker">
      <button type="button" onClick={() => onSelect({ id: "media-photo-1", name: "ภาพบุคลากร" })}>เลือกไฟล์ทดสอบ</button>
      <button type="button" onClick={onClose}>ปิดคลังสื่อ</button>
    </div>
  )
}));

const person: OrganizationPersonnelRow = {
  id: "person-1",
  display_name: "บุคลากร ทดสอบ",
  personnel_type: "ครู",
  employment_position: "ครูชำนาญการ",
  photo_media_id: null,
  public_email: "private@example.invalid",
  public_phone: "0990000000",
  show_public_email: 0,
  show_public_phone: 0,
  active: 1,
  revision: 3
};

function show(canManage = false, canBrowseMedia = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationPersonnelDirectory canManage={canManage} canBrowseMedia={canBrowseMedia} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getCollection.mockImplementation(async (_collection: string, _limit: number, offset: number) => ({
    items: offset ? [{ ...person, id: "person-2", display_name: "บุคลากร คนที่สอง" }] : [person],
    nextOffset: offset ? null : 1,
    maximumItems: 100,
    generatedAt: ""
  }));
  api.create.mockResolvedValue({ item: {} });
  api.update.mockResolvedValue({ item: {} });
  api.remove.mockResolvedValue({ id: person.id, deleted: true });
});

describe("Phase 5 canonical personnel directory", () => {
  it("hides private contact fields and all mutations for read-only users", async () => {
    show();
    expect(await screen.findByText("บุคลากร ทดสอบ")).toBeInTheDocument();
    expect(screen.queryByText("private@example.invalid")).not.toBeInTheDocument();
    expect(screen.queryByText("0990000000")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มบุคลากร" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
  });

  it("loads subsequent pages in a shared personnel directory", async () => {
    show();
    await screen.findByText("บุคลากร ทดสอบ");
    fireEvent.click(screen.getByRole("button", { name: "โหลดบุคลากรเพิ่มเติม" }));
    expect(await screen.findByText("บุคลากร คนที่สอง")).toBeInTheDocument();
    expect(api.getCollection).toHaveBeenCalledWith("personnel", 100, 1);
  });

  it("creates one canonical record with contact visibility disabled by default", async () => {
    show(true);
    fireEvent.click(await screen.findByRole("button", { name: "เพิ่มบุคลากร" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อ-นามสกุล" }), { target: { value: "บุคลากร ใหม่" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกบุคลากร" }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith("personnel", expect.objectContaining({
        displayName: "บุคลากร ใหม่",
        photoMediaId: null,
        showPublicEmail: false,
        showPublicPhone: false,
        active: true
      }))
    );
  });

  it("edits the exact revision and reuses a selected existing Media Library image", async () => {
    show(true, true);
    fireEvent.click(await screen.findByRole("button", { name: "แก้ไข" }));
    fireEvent.click(screen.getByRole("button", { name: "เลือกรูปภาพ" }));
    fireEvent.click(screen.getByRole("button", { name: "เลือกไฟล์ทดสอบ" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกบุคลากร" }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith("personnel", "person-1", 3,
        expect.objectContaining({ photoMediaId: "media-photo-1" }))
    );
  });

  it("deletes a canonical record only via confirmed revision-safe delete", async () => {
    show(true);
    fireEvent.click(await screen.findByRole("button", { name: "ลบ" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("personnel", "person-1", 3));
  });
});
