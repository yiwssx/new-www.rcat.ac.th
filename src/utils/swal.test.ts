import { beforeEach, describe, expect, it, vi } from "vitest";

const swalInstance = vi.hoisted(() => ({
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn(),
  update: vi.fn()
}));

vi.mock("sweetalert2", () => ({
  default: {
    mixin: vi.fn(() => swalInstance)
  }
}));

vi.mock("sweetalert2/dist/sweetalert2.min.css", () => ({}));

import { appSwal, showBlockingLoading, updateBlockingLoading } from "./swal";

describe("blocking loading progress", () => {
  beforeEach(async () => {
    swalInstance.fire.mockReset();
    swalInstance.fire.mockResolvedValue({ isConfirmed: true });
    swalInstance.close.mockReset();
    swalInstance.showLoading.mockReset();
    swalInstance.update.mockReset();
    document.body.replaceChildren();
    await appSwal.close();
    swalInstance.close.mockClear();
  });

  it("renders a determinate progress bar without entering the browser top layer", async () => {
    showBlockingLoading("กำลังบันทึกเนื้อหา", "10% • กำลังตรวจสอบข้อมูลก่อนบันทึก");

    await vi.waitFor(() => expect(swalInstance.fire).toHaveBeenCalledTimes(1));
    const options = swalInstance.fire.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(options).toEqual(
      expect.objectContaining({
        title: "กำลังบันทึกเนื้อหา",
        text: "10% • กำลังตรวจสอบข้อมูลก่อนบันทึก",
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );
    expect(options).not.toHaveProperty("topLayer");
    expect(options.html).toEqual(expect.stringContaining('role="progressbar"'));
    expect(options.html).toEqual(expect.stringContaining('aria-valuenow="10"'));
    expect(options.html).toEqual(expect.stringContaining("กำลังตรวจสอบข้อมูลก่อนบันทึก"));
  });

  it("aligns the blocking popup with the active MUI modal stack", async () => {
    const modal = document.createElement("div");
    modal.className = "MuiModal-root";
    modal.style.zIndex = "1300";

    const container = document.createElement("div");
    container.className = "swal2-container";
    container.style.zIndex = "1060";
    const popup = document.createElement("div");
    container.append(popup);
    document.body.append(modal, container);

    showBlockingLoading("กำลังบันทึกเนื้อหา", "10% • กำลังตรวจสอบข้อมูลก่อนบันทึก");
    await vi.waitFor(() => expect(swalInstance.fire).toHaveBeenCalledTimes(1));

    const options = swalInstance.fire.mock.calls[0]?.[0] as { didOpen?: (popup: HTMLElement) => void };
    options.didOpen?.(popup);

    expect(container.style.zIndex).toBe("1300");
    await vi.waitFor(() => expect(swalInstance.showLoading).toHaveBeenCalledTimes(1));
  });

  it("replays the latest progress after the lazy SweetAlert popup finishes opening", async () => {
    const container = document.createElement("div");
    container.className = "swal2-container";
    const popup = document.createElement("div");
    container.append(popup);
    document.body.append(container);

    showBlockingLoading("กำลังบันทึกเนื้อหา", "10% • กำลังตรวจสอบข้อมูลก่อนบันทึก");
    updateBlockingLoading("กำลังบันทึกเนื้อหา", "35% • กำลังดึงและจัดเก็บภาพย่อจาก Facebook");

    await vi.waitFor(() => expect(swalInstance.fire).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(swalInstance.update).toHaveBeenCalled());

    const options = swalInstance.fire.mock.calls[0]?.[0] as { didOpen?: (popup: HTMLElement) => void };
    options.didOpen?.(popup);

    await vi.waitFor(() =>
      expect(swalInstance.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: "กำลังบันทึกเนื้อหา",
          text: "35% • กำลังดึงและจัดเก็บภาพย่อจาก Facebook",
          html: expect.stringContaining('aria-valuenow="35"')
        })
      )
    );
    await vi.waitFor(() => expect(swalInstance.showLoading).toHaveBeenCalledTimes(1));
  });
});
