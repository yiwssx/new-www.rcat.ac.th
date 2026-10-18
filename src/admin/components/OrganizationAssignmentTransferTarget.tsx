import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useDroppable } from "@dnd-kit/react";

/** Drop a staff row here to choose another position or organizational unit. */
export default function OrganizationAssignmentTransferTarget({ id, disabled }: { id: string; disabled: boolean }) {
  const { ref, isDropTarget } = useDroppable({ id, disabled });
  return (
    <Box
      ref={ref}
      data-organization-assignment-transfer-target="true"
      aria-label="วางบุคลากรเพื่อย้ายข้ามตำแหน่งหรือหน่วยงาน"
      sx={{
        border: "2px dashed",
        borderColor: isDropTarget ? "primary.main" : "divider",
        bgcolor: isDropTarget ? "action.selected" : "transparent",
        borderRadius: 2,
        p: 1.5,
        textAlign: "center",
        minHeight: 58
      }}
    >
      <Typography variant="body2" color={isDropTarget ? "primary.main" : "text.secondary"}>
        {isDropTarget ? "ปล่อยเพื่อเลือกตำแหน่งปลายทาง" : "วางบุคลากรที่นี่เพื่อย้ายตำแหน่งหรือหน่วยงาน"}
      </Typography>
    </Box>
  );
}
