import type { ReactNode } from "react";
import { DialogActions } from "@mui/material";

export interface ResponsiveDialogActionsProps {
  children: ReactNode;
}

export default function ResponsiveDialogActions({ children }: ResponsiveDialogActionsProps) {
  return <DialogActions data-design-system-primitive="responsive-dialog-actions">{children}</DialogActions>;
}
