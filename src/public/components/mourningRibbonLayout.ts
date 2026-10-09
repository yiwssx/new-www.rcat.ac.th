/**
 * Ribbon uses its full square canvas at the top of the page.
 * Keep the top bar clear of the canvas; the identity section starts farther
 * down the page and can safely reserve less horizontal space.
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
  xs: "96px",
  sm: "112px",
  md: "136px",
  lg: "160px"
} as const;
