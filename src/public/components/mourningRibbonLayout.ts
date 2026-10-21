/**
 * Ribbon uses its full square canvas at the top of the page.
 * The mobile contact bar remains beside the ribbon while the identity content
 * clears it vertically, preserving usable width for the full college name.
 */
export const MOURNING_RIBBON_SIZE = {
  xs: 120,
  sm: 144,
  md: 168,
  lg: 192
} as const;

export const MOURNING_RIBBON_TOP_BAR_PADDING = {
  xs: "120px",
  sm: "144px",
  md: "168px",
  lg: "192px"
} as const;

export const MOURNING_RIBBON_IDENTITY_PADDING = {
  xs: "16px",
  sm: "24px",
  md: "136px",
  lg: "160px"
} as const;
