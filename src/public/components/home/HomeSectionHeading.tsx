import type { ReactNode } from "react";
import SectionHeader from "../../../design-system/components/SectionHeader";

export interface HomeSectionHeadingProps {
  label: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function HomeSectionHeading({ label, title, description, action, compact = false }: HomeSectionHeadingProps) {
  return (
    <SectionHeader
      eyebrow={`:: ${label}`}
      title={title}
      description={description}
      action={action}
      density={compact ? "compact" : "default"}
    />
  );
}
