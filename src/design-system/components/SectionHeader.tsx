import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
  density?: "default" | "compact";
}

export default function SectionHeader({
  title,
  description,
  action,
  eyebrow,
  density = "default"
}: SectionHeaderProps) {
  const compact = density === "compact";

  return (
    <Stack
      component="header"
      direction={{ xs: "column", sm: "row" }}
      spacing={compact ? 1 : 1.5}
      sx={{
        justifyContent: "space-between",
        alignItems: { xs: "stretch", sm: "flex-end" },
        mb: compact ? 1.5 : 2.5,
        minWidth: 0
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography
            component="p"
            variant="caption"
            sx={{
              color: "secondary.dark",
              fontWeight: 800,
              mb: compact ? 0.25 : 0.5,
              overflowWrap: "anywhere"
            }}
          >
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant={compact ? "h3" : "h2"} sx={{ overflowWrap: "anywhere", fontWeight: 800 }}>
          {title}
        </Typography>
        {description ? (
          <Typography
            variant={compact ? "body2" : undefined}
            sx={{
              color: "text.secondary",
              mt: compact ? 0.5 : 0.75,
              maxWidth: 760,
              overflowWrap: "anywhere"
            }}
          >
            {description}
          </Typography>
        ) : null}
      </Box>
      {action ? <Box sx={{ flex: "0 0 auto" }}>{action}</Box> : null}
    </Stack>
  );
}
