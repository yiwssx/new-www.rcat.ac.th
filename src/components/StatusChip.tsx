import { Chip, ChipProps } from "@mui/material";
import { ContentStatus, IntegrationState } from "../types";

const contentStatusMeta: Record<ContentStatus, { label: string; color: ChipProps["color"] }> = {
  draft: {
    label: "Draft",
    color: "default"
  },
  review: {
    label: "Review",
    color: "warning"
  },
  scheduled: {
    label: "Scheduled",
    color: "secondary"
  },
  published: {
    label: "Published",
    color: "success"
  }
};

const integrationStatusMeta: Record<IntegrationState, { label: string; color: ChipProps["color"] }> = {
  connected: {
    label: "Connected",
    color: "success"
  },
  pending: {
    label: "Pending",
    color: "warning"
  },
  error: {
    label: "Error",
    color: "error"
  }
};

interface StatusChipProps {
  status: ContentStatus | IntegrationState;
  size?: ChipProps["size"];
}

export default function StatusChip({ status, size = "small" }: StatusChipProps) {
  const meta =
    status in contentStatusMeta
      ? contentStatusMeta[status as ContentStatus]
      : integrationStatusMeta[status as IntegrationState];

  return <Chip label={meta.label} color={meta.color} size={size} variant="outlined" />;
}
