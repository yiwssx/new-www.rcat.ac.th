import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminPagination from "./AdminPagination";

describe("AdminPagination", () => {
  it("shows the Thai range and page summary and exposes accessible paging controls", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <AdminPagination
        pagination={{
          page: 2,
          pageSize: 25,
          totalItems: 86,
          totalPages: 4,
          hasPreviousPage: true,
          hasNextPage: true
        }}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    expect(screen.getByText("แสดง 26–50 จากทั้งหมด 86 รายการ")).toBeInTheDocument();
    expect(screen.getByText("หน้าที่ 2 จาก 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ไปหน้าถัดไป" }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole("combobox", { name: "รายการต่อหน้า" }));
    await user.click(screen.getByRole("option", { name: "50 รายการ" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("handles an empty list and announces background page loading", () => {
    render(
      <AdminPagination
        pagination={{
          page: 1,
          pageSize: 24,
          totalItems: 0,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false
        }}
        pageSizeOptions={[24, 48, 96]}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        isFetching
      />
    );

    expect(screen.getByText("แสดง 0 จากทั้งหมด 0 รายการ")).toBeInTheDocument();
    expect(screen.getByText("หน้าที่ 1 จาก 0")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "กำลังโหลดหน้ารายการ" })).toBeInTheDocument();
  });
});
