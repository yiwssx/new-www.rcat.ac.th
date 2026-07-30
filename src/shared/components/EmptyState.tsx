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
      component="section"
      data-design-system-primitive="empty-state"
      aria-label={title}
      sx={{
        py: 4,
        px: 2,
        minHeight: 150,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.default",
        overflowWrap: "anywhere"
      }}
    >
      <Box>
        {icon && <Box sx={{ color: "primary.main", mb: 1 }}>{icon}</Box>}
        <Typography
          sx={{
            fontWeight: 900
          }}
        >
          {title}
        </Typography>
        {description && (
          <Typography
            sx={{
              color: "text.secondary",
              mt: 0.6
            }}
          >
            {description}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
