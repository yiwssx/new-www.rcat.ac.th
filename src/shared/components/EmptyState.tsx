import { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

export default function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <Box
      sx={{
        py: 4,
        px: 2,
        minHeight: 150,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        border: "1px dashed rgba(31, 90, 44, 0.22)",
        borderRadius: 2,
        bgcolor: "background.default"
      }}
    >
      <Box>
        {icon && <Box sx={{ color: "primary.main", mb: 1 }}>{icon}</Box>}
        <Typography fontWeight={900}>{title}</Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 0.6 }}>
            {description}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
