import { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

interface PageHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", md: "center" }}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.7rem", md: "2.1rem" } }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
          {description}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}
