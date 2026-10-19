import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useDroppable } from "@dnd-kit/react";

/** A target shared by all position rows in the same parent DragDropProvider.
 * It starts an explicit cross-group move review; dropping alone never writes.
 */
export default function OrganizationPositionGroupDropTarget({
  id,
  groupLabel,
  disabled
}: {
  id: string;
  groupLabel: string;
  disabled: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({ id, disabled });
  return (
    <Box
      ref={ref}
      data-organization-position-group-target={id}
      aria-label={"วางตำแหน่งในกลุ่ม " + (groupLabel || "ไม่ระบุกลุ่ม")}
      sx={{
        p: 1.5,
        minHeight: 56,
        border: "2px dashed",
        borderColor: isDropTarget ? "primary.main" : "divider",
        bgcolor: isDropTarget ? "action.selected" : "transparent",
        borderRadius: 2,
        textAlign: "center"
      }}
    >
      <Typography variant="body2" color={isDropTarget ? "primary.main" : "text.secondary"}>
        {isDropTarget ? "ปล่อยเพื่อเลือกย้ายตำแหน่ง" : "วางตำแหน่งในกลุ่มนี้"}
      </Typography>
    </Box>
  );
}
