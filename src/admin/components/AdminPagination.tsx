import { useId } from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Typography
} from "@mui/material";
import type { AdminPaginationMetadata } from "../../features/admin-pagination";
import { ADMIN_PAGE_SIZE_OPTIONS } from "../../features/admin-pagination";

export interface AdminPaginationProps {
  pagination: AdminPaginationMetadata;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  disabled?: boolean;
  isFetching?: boolean;
}

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString("th-TH");
}

function getRangeLabel({ page, pageSize, totalItems }: AdminPaginationMetadata) {
  if (totalItems <= 0) {
    return "แสดง 0 จากทั้งหมด 0 รายการ";
  }

  const firstItem = (Math.max(1, page) - 1) * pageSize + 1;
  const lastItem = Math.min(Math.max(1, page) * pageSize, totalItems);
  return `แสดง ${formatCount(firstItem)}–${formatCount(lastItem)} จากทั้งหมด ${formatCount(totalItems)} รายการ`;
}

export default function AdminPagination({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS,
  disabled = false,
  isFetching = false
}: AdminPaginationProps) {
  const selectLabelId = useId();
  const totalPages = Math.max(0, pagination.totalPages);
  const isEmpty = pagination.totalItems <= 0 || totalPages === 0;
  const page = Math.min(Math.max(1, pagination.page), Math.max(1, totalPages));

  return (
    <Stack
      component="nav"
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      alignItems={{ xs: "stretch", md: "center" }}
      justifyContent="space-between"
      sx={{ py: 2 }}
      aria-label="การแบ่งหน้ารายการ"
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {getRangeLabel(pagination)}
        </Typography>
        {isFetching && (
          <Box role="status" aria-label="กำลังโหลดหน้ารายการ" sx={{ display: "inline-flex" }}>
            <CircularProgress size={16} />
          </Box>
        )}
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
        <Typography variant="body2" color="text.secondary" textAlign={{ xs: "left", sm: "center" }}>
          {isEmpty ? "ไม่มีรายการ" : `หน้าที่ ${formatCount(page)} จาก ${formatCount(totalPages)}`}
        </Typography>
        <Pagination
          page={page}
          count={Math.max(1, totalPages)}
          disabled={disabled || isEmpty}
          onChange={(_, nextPage) => onPageChange(nextPage)}
          color="primary"
          shape="rounded"
          showFirstButton
          showLastButton
          getItemAriaLabel={(type, itemPage, selected) => {
            if (type === "page") {
              return selected ? `หน้าปัจจุบัน หน้าที่ ${itemPage}` : `ไปหน้าที่ ${itemPage}`;
            }

            if (type === "first") return "ไปหน้าแรก";
            if (type === "last") return "ไปหน้าสุดท้าย";
            if (type === "next") return "ไปหน้าถัดไป";
            if (type === "previous") return "ไปหน้าก่อนหน้า";
            return "หน้าที่ซ่อนไว้";
          }}
          sx={{ alignSelf: { xs: "center", sm: "auto" } }}
        />
        <FormControl size="small" sx={{ minWidth: 132 }} disabled={disabled || isEmpty}>
          <InputLabel id={selectLabelId}>รายการต่อหน้า</InputLabel>
          <Select<number>
            labelId={selectLabelId}
            label="รายการต่อหน้า"
            value={pagination.pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {formatCount(option)} รายการ
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Stack>
  );
}

export { AdminPagination };
