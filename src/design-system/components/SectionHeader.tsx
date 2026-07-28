import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}

export default function SectionHeader({ title, description, action, eyebrow }: SectionHeaderProps) {
  return (
    <Stack
      component="header"
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: "stretch", sm: "flex-end" }}
      sx={{ mb: 2.5, minWidth: 0 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography
            component="p"
            variant="caption"
            sx={{ color: "secondary.dark", fontWeight: 800, mb: 0.5, overflowWrap: "anywhere" }}
          >
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h2" sx={{ overflowWrap: "anywhere" }}>
          {title}
        </Typography>
        {description ? (
          <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760, overflowWrap: "anywhere" }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {action ? <Box sx={{ flex: "0 0 auto" }}>{action}</Box> : null}
    </Stack>
  );
}
