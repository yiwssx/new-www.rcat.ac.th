import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}

export default function PageHeader({ title, description, action, eyebrow }: PageHeaderProps) {
  return (
    <Stack
      component="header"
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      justifyContent="space-between"
      alignItems={{ xs: "stretch", md: "center" }}
      sx={{ mb: 3, minWidth: 0 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography variant="caption" color="secondary.dark" sx={{ display: "block", mb: 0.5, fontWeight: 800 }}>
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h1" sx={{ overflowWrap: "anywhere" }}>
          {title}
        </Typography>
        {description ? (
          <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760, overflowWrap: "anywhere" }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {action ? <Box sx={{ flex: "0 0 auto", alignSelf: { xs: "stretch", md: "center" } }}>{action}</Box> : null}
    </Stack>
  );
}
