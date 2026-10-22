import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useDraggable } from "@dnd-kit/react";
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

/**
 * A position group has explicit drop zones separate from the group heading.
 * The heading is draggable, but must not be a sortable/droppable itself:
 * otherwise the sortable heading can win collision detection over its target.
 */
export function OrganizationDraggableGroupHeading({
  id,
  disabled,
  label,
  children
}: {
  id: string;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  const { ref, handleRef, isDragging } = useDraggable({ id, disabled });
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
