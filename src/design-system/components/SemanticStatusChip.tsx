import { Chip, type ChipProps } from "@mui/material";
import { semanticStatusTokens, type SemanticStatus } from "../tokens";

export interface SemanticStatusChipProps {
  label: string;
  status: SemanticStatus;
  size?: ChipProps["size"];
  emphasized?: boolean;
}

export default function SemanticStatusChip({
  label,
  status,
  size = "small",
  emphasized = false
}: SemanticStatusChipProps) {
  const statusTokens = semanticStatusTokens[status];

  return (
    <Chip
      data-semantic-status={status}
      label={label}
      size={size}
      variant="outlined"
      sx={{
        color: statusTokens.text,
        bgcolor: statusTokens.background,
        borderColor: statusTokens.border,
        borderWidth: 1,
        fontWeight: 800,
        animation: emphasized ? "rcat-status-pulse 1.8s ease-in-out infinite" : undefined,
        "@media (prefers-reduced-motion: reduce)": {
          animation: "none"
        }
      }}
    />
  );
}
