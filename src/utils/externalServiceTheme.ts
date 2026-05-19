import type { ExternalServiceTone } from "../types";

interface ExternalServiceToneStyle {
  iconBg: string;
  iconColor: string;
}

const externalServiceToneStyles: Record<ExternalServiceTone, ExternalServiceToneStyle> = {
  student: {
    iconBg: "var(--rcat-primary)",
    iconColor: "var(--rcat-surface)"
  },
  homeroom: {
    iconBg: "var(--rcat-secondary)",
    iconColor: "var(--rcat-surface)"
  },
  management: {
    iconBg: "var(--rcat-primary-hover)",
    iconColor: "var(--rcat-surface)"
  },
  learning: {
    iconBg: "var(--rcat-primary)",
    iconColor: "var(--rcat-surface)"
  },
  calendar: {
    iconBg: "var(--rcat-accent-soft)",
    iconColor: "var(--rcat-primary-hover)"
  },
  check: {
    iconBg: "var(--rcat-secondary)",
    iconColor: "var(--rcat-surface)"
  },
  admission: {
    iconBg: "var(--rcat-accent)",
    iconColor: "var(--rcat-text)"
  },
  career: {
    iconBg: "var(--rcat-primary-hover)",
    iconColor: "var(--rcat-surface)"
  },
  general: {
    iconBg: "var(--rcat-primary)",
    iconColor: "var(--rcat-surface)"
  }
};

export function getExternalServiceToneStyle(tone: ExternalServiceTone): ExternalServiceToneStyle {
  return externalServiceToneStyles[tone] ?? externalServiceToneStyles.general;
}
