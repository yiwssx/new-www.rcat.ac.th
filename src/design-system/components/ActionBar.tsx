import type { ReactNode } from "react";
import { Stack } from "@mui/material";

export interface ActionBarProps {
  primary: ReactNode;
  secondary?: ReactNode;
  ariaLabel?: string;
}

export default function ActionBar({ primary, secondary, ariaLabel = "เครื่องมือและตัวกรอง" }: ActionBarProps) {
  return (
    <Stack
      component="section"
      aria-label={ariaLabel}
      direction={{ xs: "column", lg: "row" }}
      spacing={2}
      sx={{
        justifyContent: "space-between",
        alignItems: { xs: "stretch", lg: "center" },
        mb: 2,
        minWidth: 0
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        useFlexGap
        sx={{
          flexWrap: "wrap",
          minWidth: 0
        }}
      >
        {primary}
      </Stack>
      {secondary ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          useFlexGap
          sx={{
            flexWrap: "wrap",
            flex: "0 1 auto",
            minWidth: 0
          }}
        >
          {secondary}
        </Stack>
      ) : null}
    </Stack>
  );
}
