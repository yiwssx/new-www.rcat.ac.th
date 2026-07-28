export const designTokens = {
  color: {
    brandPrimary: "#2c7a3f",
    brandPrimaryStrong: "#1f5a2c",
    brandPrimarySoft: "#e8f5e9",
    brandAccent: "#b88700",
    brandAccentStrong: "#6f5000",
    brandAccentSoft: "#fff4c2",
    pageCanvas: "#f8fbf2",
    surfaceDefault: "#ffffff",
    surfaceSubtle: "#f1f6f0",
    surfaceEmphasized: "#e8f5e9",
    surfaceInverse: "#1f5a2c",
    textPrimary: "#203324",
    textSecondary: "#526456",
    textInverse: "#ffffff",
    textOnAccent: "#302300",
    link: "#1f5a2c",
    linkHover: "#174522",
    borderSubtle: "#cbd9cd",
    borderStrong: "#78917d",
    focusRing: "#9a7000",
    success: "#2f7a39",
    successText: "#235b2b",
    successSurface: "#e5f4e7",
    warning: "#a77500",
    warningText: "#694b00",
    warningSurface: "#fff0b3",
    error: "#c84d3a",
    errorText: "#8d2f22",
    errorSurface: "#fde9e5",
    information: "#2774a6",
    informationText: "#174e75",
    informationSurface: "#e2f1fb",
    disabledText: "#5f6c63",
    disabledSurface: "#edf1ee"
  },
  radius: {
    none: 0,
    small: 4,
    medium: 8,
    large: 16,
    pill: 999
  },
  elevation: {
    none: "none",
    low: "0 4px 14px rgba(31, 90, 44, 0.08)",
    medium: "0 12px 30px rgba(31, 90, 44, 0.12)",
    high: "0 18px 44px rgba(31, 90, 44, 0.16)",
    overlay: "0 24px 60px rgba(18, 44, 24, 0.22)"
  },
  typography: {
    fontFamily: ['"Sarabun"', '"Noto Sans Thai"', '"Segoe UI"', "sans-serif"],
    display: {
      fontSize: "clamp(2rem, 3vw, 2.75rem)",
      fontWeight: 800,
      lineHeight: 1.28
    },
    pageTitle: {
      fontSize: "clamp(1.75rem, 2.6vw, 2.35rem)",
      fontWeight: 800,
      lineHeight: 1.3
    },
    sectionTitle: {
      fontSize: "clamp(1.35rem, 2vw, 1.9rem)",
      fontWeight: 800,
      lineHeight: 1.34
    },
    cardTitle: {
      fontSize: "clamp(1.08rem, 1.4vw, 1.35rem)",
      fontWeight: 700,
      lineHeight: 1.4
    },
    body: {
      fontSize: "1rem",
      fontWeight: 400,
      lineHeight: 1.5
    },
    compactBody: {
      fontSize: "0.9rem",
      fontWeight: 400,
      lineHeight: 1.5
    },
    label: {
      fontSize: "0.9rem",
      fontWeight: 700,
      lineHeight: 1.5
    },
    caption: {
      fontSize: "0.78rem",
      fontWeight: 500,
      lineHeight: 1.5
    },
    button: {
      fontSize: "0.94rem",
      fontWeight: 700,
      lineHeight: 1.4
    }
  },
  control: {
    comfortableHeight: 44,
    compactHeight: 40,
    largeHeight: 48,
    iconButtonTarget: 44,
    inputHeight: 48,
    focusRingThickness: 3,
    focusRingOffset: 2
  },
  motion: {
    duration: {
      short: 120,
      standard: 180,
      deliberate: 260
    },
    easing: "cubic-bezier(0.2, 0, 0, 1)"
  },
  spacingUnit: 8
} as const;

export const semanticStatusTokens = {
  success: {
    text: designTokens.color.successText,
    background: designTokens.color.successSurface,
    border: designTokens.color.success
  },
  warning: {
    text: designTokens.color.warningText,
    background: designTokens.color.warningSurface,
    border: designTokens.color.warning
  },
  error: {
    text: designTokens.color.errorText,
    background: designTokens.color.errorSurface,
    border: designTokens.color.error
  },
  information: {
    text: designTokens.color.informationText,
    background: designTokens.color.informationSurface,
    border: designTokens.color.information
  },
  draft: {
    text: designTokens.color.textSecondary,
    background: designTokens.color.disabledSurface,
    border: designTokens.color.borderStrong
  },
  published: {
    text: designTokens.color.successText,
    background: designTokens.color.successSurface,
    border: designTokens.color.success
  },
  disabled: {
    text: designTokens.color.disabledText,
    background: designTokens.color.disabledSurface,
    border: designTokens.color.borderSubtle
  },
  active: {
    text: designTokens.color.successText,
    background: designTokens.color.successSurface,
    border: designTokens.color.success
  },
  scheduled: {
    text: designTokens.color.warningText,
    background: designTokens.color.warningSurface,
    border: designTokens.color.warning
  },
  ended: {
    text: designTokens.color.errorText,
    background: designTokens.color.errorSurface,
    border: designTokens.color.error
  }
} as const;

export type SemanticStatus = keyof typeof semanticStatusTokens;

export const designTokenCssVariables = {
  "--rcat-color-brand-primary": designTokens.color.brandPrimary,
  "--rcat-color-brand-primary-strong": designTokens.color.brandPrimaryStrong,
  "--rcat-color-brand-primary-soft": designTokens.color.brandPrimarySoft,
  "--rcat-color-brand-accent": designTokens.color.brandAccent,
  "--rcat-color-brand-accent-strong": designTokens.color.brandAccentStrong,
  "--rcat-color-brand-accent-soft": designTokens.color.brandAccentSoft,
  "--rcat-color-page-canvas": designTokens.color.pageCanvas,
  "--rcat-color-surface": designTokens.color.surfaceDefault,
  "--rcat-color-surface-subtle": designTokens.color.surfaceSubtle,
  "--rcat-color-surface-emphasized": designTokens.color.surfaceEmphasized,
  "--rcat-color-surface-inverse": designTokens.color.surfaceInverse,
  "--rcat-color-text": designTokens.color.textPrimary,
  "--rcat-color-text-secondary": designTokens.color.textSecondary,
  "--rcat-color-text-inverse": designTokens.color.textInverse,
  "--rcat-color-text-on-accent": designTokens.color.textOnAccent,
  "--rcat-color-link": designTokens.color.link,
  "--rcat-color-border-subtle": designTokens.color.borderSubtle,
  "--rcat-color-border-strong": designTokens.color.borderStrong,
  "--rcat-color-focus": designTokens.color.focusRing,
  "--rcat-radius-sm": `${designTokens.radius.small}px`,
  "--rcat-radius-md": `${designTokens.radius.medium}px`,
  "--rcat-radius-lg": `${designTokens.radius.large}px`,
  "--rcat-radius-pill": `${designTokens.radius.pill}px`,
  "--rcat-elevation-low": designTokens.elevation.low,
  "--rcat-elevation-medium": designTokens.elevation.medium,
  "--rcat-elevation-high": designTokens.elevation.high,
  "--rcat-motion-short": `${designTokens.motion.duration.short}ms`,
  "--rcat-motion-standard": `${designTokens.motion.duration.standard}ms`,
  "--rcat-motion-deliberate": `${designTokens.motion.duration.deliberate}ms`,
  "--rcat-motion-easing": designTokens.motion.easing
} as const;
