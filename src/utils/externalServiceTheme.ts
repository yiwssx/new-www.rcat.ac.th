export type ExternalServiceIconSource = "media" | "link";

interface ExternalServiceIconSurfaceStyle {
  backgroundColor: string;
  borderColor: string;
  boxShadow: string;
  color: string;
}

const externalServiceIconSurfaceStyles: Record<ExternalServiceIconSource, ExternalServiceIconSurfaceStyle> = {
  media: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    boxShadow: "none",
    color: "inherit"
  },
  link: {
    backgroundColor: "var(--rcat-primary-soft)",
    borderColor: "var(--rcat-border)",
    boxShadow: "none",
    color: "var(--rcat-primary-hover)"
  }
};

export function getExternalServiceIconSurfaceStyle(source: ExternalServiceIconSource): ExternalServiceIconSurfaceStyle {
  return externalServiceIconSurfaceStyles[source];
}
