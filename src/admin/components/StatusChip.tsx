import type { ChipProps } from "@mui/material";
import { ContentStatus, IntegrationState } from "../../types";
import { contentStatusLabels, integrationStateLabels } from "../../utils/thaiLabels";
import SemanticStatusChip from "../../design-system/components/SemanticStatusChip";
import type { SemanticStatus } from "../../design-system/tokens";

const contentStatusMeta: Record<ContentStatus, { label: string; status: SemanticStatus }> = {
  draft: {
    label: contentStatusLabels.draft,
    status: "draft"
  },
  review: {
    label: contentStatusLabels.review,
    status: "warning"
  },
  scheduled: {
    label: contentStatusLabels.scheduled,
    status: "scheduled"
  },
  published: {
    label: contentStatusLabels.published,
    status: "published"
  }
};

const integrationStatusMeta: Record<IntegrationState, { label: string; status: SemanticStatus }> = {
  connected: {
    label: integrationStateLabels.connected,
    status: "success"
  },
  pending: {
    label: integrationStateLabels.pending,
    status: "warning"
  },
  error: {
    label: integrationStateLabels.error,
    status: "error"
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

  return <SemanticStatusChip label={meta.label} status={meta.status} size={size} />;
}
