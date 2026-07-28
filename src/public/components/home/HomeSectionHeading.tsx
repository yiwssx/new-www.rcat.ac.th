import type { ReactNode } from "react";
import SectionHeader from "../../../design-system/components/SectionHeader";

export interface HomeSectionHeadingProps {
  label: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function HomeSectionHeading({ label, title, description, action }: HomeSectionHeadingProps) {
  return <SectionHeader eyebrow={`:: ${label}`} title={title} description={description} action={action} />;
}
