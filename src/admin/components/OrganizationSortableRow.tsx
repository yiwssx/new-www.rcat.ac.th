import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useSortable } from "@dnd-kit/react/sortable";

/** Explicit drag handle: action buttons and selection remain usable while sorting. */
export function OrganizationSortableRow({
  id,
  index,
  group,
  disabled,
  label,
  children
}: {
  id: string;
  index: number;
  group: string;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id, index, group, disabled });
  return (
    <Box ref={ref} sx={{ opacity: isDragging ? 0.55 : 1, minWidth: 0, position: "relative" }}>
      {!disabled && (
        <Button
          ref={handleRef}
          size="small"
          variant="outlined"
          aria-label={`ลากจัดลำดับ ${label}`}
          sx={{ mb: 0.5, touchAction: "none", cursor: "grab" }}
        >
          จับลากเพื่อเรียงลำดับ
        </Button>
      )}
      {children}
    </Box>
  );
}
