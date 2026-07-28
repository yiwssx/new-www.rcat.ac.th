import type { CSSProperties } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import { designTokens } from "./tokens";

export const focusRingStyles = {
  outline: `${designTokens.control.focusRingThickness}px solid ${designTokens.color.focusRing}`,
  outlineOffset: designTokens.control.focusRingOffset
} satisfies CSSProperties;

export const focusVisibleSx = {
  "&:focus-visible": focusRingStyles
} satisfies SxProps<Theme>;

export const interactiveSurfaceSx = {
  transition: `box-shadow ${designTokens.motion.duration.standard}ms ${designTokens.motion.easing}, transform ${designTokens.motion.duration.standard}ms ${designTokens.motion.easing}`,
  ...focusVisibleSx,
  "&:hover": {
    boxShadow: designTokens.elevation.medium
  },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    "&:hover": {
      transform: "none"
    }
  }
} satisfies SxProps<Theme>;

export const staticSurfaceSx = {
  border: `1px solid ${designTokens.color.borderSubtle}`,
  borderRadius: `${designTokens.radius.medium}px`,
  backgroundColor: designTokens.color.surfaceDefault,
  boxShadow: designTokens.elevation.none
} satisfies SxProps<Theme>;
