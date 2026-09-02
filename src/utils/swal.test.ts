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
    await appSwal.close();
    swalInstance.close.mockClear();
  });

  it("renders a determinate progress bar when the loading text contains a percentage", async () => {
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
    expect(options.html).toEqual(expect.stringContaining('role="progressbar"'));
    expect(options.html).toEqual(expect.stringContaining('aria-valuenow="10"'));
    expect(options.html).toEqual(expect.stringContaining("กำลังตรวจสอบข้อมูลก่อนบันทึก"));
  });

  it("replays the latest progress after the lazy SweetAlert popup finishes opening", async () => {
    showBlockingLoading("กำลังบันทึกเนื้อหา", "10% • กำลังตรวจสอบข้อมูลก่อนบันทึก");
    updateBlockingLoading("กำลังบันทึกเนื้อหา", "35% • กำลังดึงและจัดเก็บภาพย่อจาก Facebook");

    await vi.waitFor(() => expect(swalInstance.fire).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(swalInstance.update).toHaveBeenCalled());

    const options = swalInstance.fire.mock.calls[0]?.[0] as { didOpen?: () => void };
    options.didOpen?.();

    await vi.waitFor(() =>
      expect(swalInstance.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: "กำลังบันทึกเนื้อหา",
          text: "35% • กำลังดึงและจัดเก็บภาพย่อจาก Facebook",
          html: expect.stringContaining('aria-valuenow="35"')
        })
      )
    );
    expect(swalInstance.showLoading).toHaveBeenCalledTimes(1);
  });
});
