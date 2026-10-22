/**
 * Ribbon uses its full square canvas at the top of the page.
 * Mobile reserves the ribbon width in the contact bar grid, without padding
 * offsets in the identity section. Desktop retains the fixed ribbon clearance.
 */
export const MOURNING_RIBBON_SIZE = {
  xs: 96,
  sm: 112,
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
