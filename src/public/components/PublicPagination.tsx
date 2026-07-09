import { Pagination, Stack, Typography } from "@mui/material";

interface PublicPaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
}

function getVisibleRange(page: number, pageSize: number, totalItems: number) {
  if (totalItems <= 0) {
    return {
      start: 0,
      end: 0
    };
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, totalItems);

  return { start, end };
}

export function PublicPagination({
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
  ariaLabel = "เปลี่ยนหน้ารายการ"
}: PublicPaginationProps) {
  if (totalItems <= 0) {
    return null;
  }

  const { start, end } = getVisibleRange(page, pageSize, totalItems);

  return (
    <Stack spacing={1.4} alignItems="center" sx={{ mt: 3 }}>
      <Typography color="text.secondary" variant="body2" aria-live="polite">
        แสดง {start}–{end} จากทั้งหมด {totalItems} รายการ
      </Typography>
      {pageCount > 1 && (
        <Pagination
          color="primary"
          count={pageCount}
          getItemAriaLabel={(type, itemPage, selected) => {
            if (type === "page") {
              return selected ? `หน้าปัจจุบัน ${itemPage}` : `ไปหน้าที่ ${itemPage}`;
            }

            switch (type) {
              case "first":
                return "ไปหน้าแรก";
              case "last":
                return "ไปหน้าสุดท้าย";
              case "next":
                return "ไปหน้าถัดไป";
              case "previous":
                return "ไปหน้าก่อนหน้า";
              default:
                return "เปลี่ยนหน้า";
            }
          }}
          onChange={(_, nextPage) => onPageChange(nextPage)}
          page={page}
          shape="rounded"
          showFirstButton
          showLastButton
          aria-label={ariaLabel}
        />
      )}
    </Stack>
  );
}
