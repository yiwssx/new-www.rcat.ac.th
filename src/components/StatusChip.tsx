import { Chip, ChipProps } from "@mui/material";
import { ContentStatus, IntegrationState } from "../types";
import { contentStatusLabels, integrationStateLabels } from "../utils/thaiLabels";

const contentStatusMeta: Record<ContentStatus, { label: string; color: ChipProps["color"] }> = {
  draft: {
    label: contentStatusLabels.draft,
    color: "default"
  },
  review: {
    label: contentStatusLabels.review,
    color: "warning"
  },
  scheduled: {
    label: contentStatusLabels.scheduled,
    color: "secondary"
  },
  published: {
    label: contentStatusLabels.published,
    color: "success"
  }
};

const integrationStatusMeta: Record<IntegrationState, { label: string; color: ChipProps["color"] }> = {
  connected: {
    label: integrationStateLabels.connected,
    color: "success"
  },
  pending: {
    label: integrationStateLabels.pending,
    color: "warning"
  },
  error: {
    label: integrationStateLabels.error,
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
