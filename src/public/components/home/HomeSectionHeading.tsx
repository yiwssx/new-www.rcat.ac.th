import { ReactNode } from "react";
import { Stack, Typography } from "@mui/material";

export interface HomeSectionHeadingProps {
  label: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function HomeSectionHeading({ label, title, description, action }: HomeSectionHeadingProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "flex-end" }}
      sx={{ mb: 2.5 }}
    >
      <Stack spacing={0.75}>
        <Typography
          component="p"
          sx={{
            color: "secondary.dark",
            fontSize: "0.78rem",
            fontWeight: 800,
            letterSpacing: 0,
            textTransform: "uppercase"
          }}
        >
          :: {label}
        </Typography>
        <Typography variant="h2">{title}</Typography>
        {description && (
          <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
            {description}
          </Typography>
        )}
      </Stack>
      {action}
    </Stack>
  );
}
