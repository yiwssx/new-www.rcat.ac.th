/**
 * The ribbon stays fixed while scrolling at every viewport size.
 * The smaller mobile footprint leaves more width for complete contact details;
 * desktop clearance and identity spacing remain unchanged.
 */
export const MOURNING_RIBBON_SIZE = {
  xs: 64,
  sm: 72,
  md: 168,
  lg: 192
} as const;

export const MOURNING_RIBBON_TOP_BAR_PADDING = {
  md: "168px",
  lg: "192px"
} as const;

export const MOURNING_RIBBON_IDENTITY_PADDING = {
  xs: "16px",
  sm: "24px",
  md: "136px",
  lg: "160px"
} as const;
