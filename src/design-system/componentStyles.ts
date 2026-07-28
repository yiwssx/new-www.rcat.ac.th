import type { CSSProperties } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import { designTokens } from "./tokens";

export const focusRingShadow = `0 0 0 ${designTokens.control.focusRingOffset}px ${designTokens.color.focusSeparation}, 0 0 0 ${designTokens.control.focusRingExtent}px ${designTokens.color.focusRing}`;

export const focusRingStyles = {
  outline: `${designTokens.control.focusRingOffset}px solid transparent`,
  outlineOffset: designTokens.control.focusRingOffset,
  boxShadow: focusRingShadow
} satisfies CSSProperties;

export const focusVisibleSx = {
  "&:focus-visible, &:focus-visible:hover": focusRingStyles
} satisfies SxProps<Theme>;

export const interactiveSurfaceSx = {
  transition: `box-shadow ${designTokens.motion.duration.standard}ms ${designTokens.motion.easing}, transform ${designTokens.motion.duration.standard}ms ${designTokens.motion.easing}`,
  "&:hover": {
    boxShadow: designTokens.elevation.medium
  },
  ...focusVisibleSx,
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
