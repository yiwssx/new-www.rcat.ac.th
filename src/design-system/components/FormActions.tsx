import type { ReactNode } from "react";
import { Stack } from "@mui/material";

export interface FormActionsProps {
  primary: ReactNode;
  secondary?: ReactNode;
}

export default function FormActions({ primary, secondary }: FormActionsProps) {
  return (
    <Stack
      direction={{ xs: "column-reverse", sm: "row" }}
      spacing={1}
      sx={{
        justifyContent: "flex-end",
        alignItems: { xs: "stretch", sm: "center" },

        "& > *": {
          width: { xs: "100%", sm: "auto" }
        }
      }}
    >
      {secondary}
      {primary}
    </Stack>
  );
}
