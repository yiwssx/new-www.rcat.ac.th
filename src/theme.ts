import { alpha, createTheme } from "@mui/material/styles";
import { focusRingShadow, focusRingStyles, focusVisibleSx } from "./design-system/componentStyles";
import { designTokenCssVariables, designTokens } from "./design-system/tokens";

const { color, control, elevation, motion, radius, typography } = designTokens;

export const theme = createTheme({
  spacing: designTokens.spacingUnit,
  palette: {
    mode: "light",
    primary: {
      main: color.brandPrimary,
      light: color.brandPrimarySoft,
      dark: color.brandPrimaryStrong,
      contrastText: color.textInverse
    },
    secondary: {
      main: color.brandAccent,
      light: color.brandAccentSoft,
      dark: color.brandAccentStrong,
      contrastText: color.textOnAccent
    },
    success: {
      main: color.success,
      light: color.successSurface,
      dark: color.successText,
      contrastText: color.textInverse
    },
    warning: {
      main: color.warning,
      light: color.warningSurface,
      dark: color.warningText,
      contrastText: color.textOnAccent
    },
    error: {
      main: color.error,
      light: color.errorSurface,
      dark: color.errorText,
      contrastText: color.textInverse
    },
    info: {
      main: color.information,
      light: color.informationSurface,
      dark: color.informationText,
      contrastText: color.textInverse
    },
    background: {
      default: color.pageCanvas,
      paper: color.surfaceDefault
    },
    text: {
      primary: color.textPrimary,
      secondary: color.textSecondary,
      disabled: color.disabledText
    },
    divider: color.borderSubtle,
    action: {
      disabled: color.disabledText,
      disabledBackground: color.disabledSurface,
      hover: alpha(color.brandPrimary, 0.08),
      selected: alpha(color.brandPrimary, 0.12)
    }
  },
  shape: {
    borderRadius: radius.medium
  },
  typography: {
    fontFamily: typography.fontFamily.join(","),
    h1: typography.pageTitle,
    h2: typography.sectionTitle,
    h3: typography.cardTitle,
    body1: typography.body,
    body2: typography.compactBody,
    subtitle1: typography.label,
    subtitle2: typography.label,
    caption: typography.caption,
    button: {
      ...typography.button,
      textTransform: "none"
    }
  },
  transitions: {
    duration: {
      shortest: motion.duration.short,
      shorter: motion.duration.short,
      short: motion.duration.standard,
      standard: motion.duration.standard,
      complex: motion.duration.deliberate,
      enteringScreen: motion.duration.deliberate,
      leavingScreen: motion.duration.standard
    },
    easing: {
      easeInOut: motion.easing,
      easeOut: motion.easing,
      easeIn: motion.easing,
      sharp: motion.easing
    }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": designTokenCssVariables,
        html: {
          colorScheme: "light"
        },
        body: {
          backgroundColor: color.pageCanvas,
          color: color.textPrimary
        },
        "a:focus-visible, button:focus-visible, [tabindex]:focus-visible": focusRingStyles,
        "@keyframes rcat-status-pulse": {
          "0%, 100%": {
            boxShadow: `0 0 0 1px ${alpha(color.brandPrimary, 0.2)}`
          },
          "50%": {
            boxShadow: `0 0 0 4px ${alpha(color.brandPrimary, 0.12)}`
          }
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "0.01ms",
            animationIterationCount: 1,
            scrollBehavior: "auto",
            transitionDuration: "0.01ms"
          }
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          minHeight: control.comfortableHeight,
          borderRadius: radius.medium,
          paddingInline: 18,
          boxShadow: elevation.none,
          transition: `background-color ${motion.duration.standard}ms ${motion.easing}, border-color ${motion.duration.standard}ms ${motion.easing}, color ${motion.duration.standard}ms ${motion.easing}`,
          "&:hover": {
            boxShadow: elevation.none
          },
          ...focusVisibleSx,
          "&.Mui-disabled": {
            color: color.disabledText,
            backgroundColor: color.disabledSurface
          }
        },
        sizeSmall: {
          minHeight: control.compactHeight,
          paddingInline: 14
        },
        sizeLarge: {
          minHeight: control.largeHeight,
          paddingInline: 22
        },
        containedError: {
          color: color.textInverse
        },
        containedSecondary: {
          color: color.textOnAccent,
          backgroundColor: color.brandAccent,
          "&:hover": {
            color: color.textOnAccent,
            backgroundColor: color.brandAccent
          }
        },
        outlinedSecondary: {
          color: color.accentForeground,
          borderColor: color.accentForeground,
          "&:hover": {
            color: color.accentForeground,
            borderColor: color.accentForeground,
            backgroundColor: alpha(color.brandAccent, 0.08)
          }
        },
        textSecondary: {
          color: color.accentForeground,
          "&:hover": {
            color: color.accentForeground,
            backgroundColor: alpha(color.brandAccent, 0.08)
          }
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          width: control.iconButtonTarget,
          height: control.iconButtonTarget,
          ...(!ownerState.color || ownerState.color === "default" ? { color: color.textSecondary } : {}),
          ...focusVisibleSx,
          "&.Mui-disabled": {
            color: color.disabledText
          }
        }),
        sizeSmall: {
          width: control.compactHeight,
          height: control.compactHeight
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${color.borderSubtle}`,
          borderRadius: radius.medium,
          boxShadow: elevation.low,
          backgroundImage: "none",
          "&[href]:focus-visible, &[href]:focus-visible:hover": focusRingStyles
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none"
        },
        rounded: {
          borderRadius: radius.medium
        },
        elevation1: {
          boxShadow: elevation.low
        },
        elevation2: {
          boxShadow: elevation.medium
        },
        elevation8: {
          boxShadow: elevation.overlay
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined"
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: control.inputHeight,
          borderRadius: radius.medium,
          backgroundColor: color.surfaceDefault,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: color.borderStrong
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: color.brandPrimary
          },
          "&.Mui-focused": {
            outline: focusRingStyles.outline,
            outlineOffset: focusRingStyles.outlineOffset,
            boxShadow: focusRingShadow
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: color.focusRing,
            borderWidth: 2
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: color.error
          },
          "&.MuiInputBase-multiline": {
            minHeight: "auto"
          }
        },
        sizeSmall: {
          minHeight: control.compactHeight
        },
        input: {
          lineHeight: typography.body.lineHeight
        }
      }
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          color: color.textSecondary,
          fontWeight: typography.label.fontWeight,
          "&.Mui-focused": {
            color: color.brandPrimaryStrong
          },
          "&.Mui-error": {
            color: color.errorText
          }
        },
        asterisk: {
          color: color.errorText
        }
      }
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginInline: 0,
          lineHeight: typography.caption.lineHeight,
          "&.Mui-error": {
            color: color.errorText
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          minHeight: 30,
          borderRadius: radius.pill,
          fontWeight: typography.label.fontWeight,
          transition: `background-color ${motion.duration.standard}ms ${motion.easing}, border-color ${motion.duration.standard}ms ${motion.easing}, color ${motion.duration.standard}ms ${motion.easing}`
        },
        sizeSmall: {
          minHeight: 26
        },
        clickable: {
          ...focusVisibleSx
        },
        filledSecondary: {
          color: color.textOnAccent,
          backgroundColor: color.brandAccent
        },
        outlinedSecondary: {
          color: color.accentForeground,
          borderColor: color.accentForeground
        },
        clickableColorSecondary: {
          "&:hover": {
            color: color.accentForeground,
            backgroundColor: color.brandAccentSoft
          }
        },
        deletableColorSecondary: {
          "& .MuiChip-deleteIcon": {
            color: alpha(color.textOnAccent, 0.72),
            "&:hover": {
              color: color.textOnAccent
            }
          },
          "&.MuiChip-outlined .MuiChip-deleteIcon": {
            color: alpha(color.accentForeground, 0.72),
            "&:hover": {
              color: color.accentForeground
            }
          }
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          border: "1px solid",
          borderRadius: radius.medium,
          alignItems: "flex-start"
        },
        standardSuccess: {
          color: color.successText,
          backgroundColor: color.successSurface,
          borderColor: color.success
        },
        standardWarning: {
          color: color.warningText,
          backgroundColor: color.warningSurface,
          borderColor: color.warning
        },
        standardError: {
          color: color.errorText,
          backgroundColor: color.errorSurface,
          borderColor: color.error
        },
        standardInfo: {
          color: color.informationText,
          backgroundColor: color.informationSurface,
          borderColor: color.information
        }
      }
    },
    MuiDialog: {
      defaultProps: {
        fullWidth: true
      },
      styleOverrides: {
        paper: {
          maxHeight: "calc(100% - 32px)",
          margin: 16,
          borderRadius: radius.large,
          boxShadow: elevation.overlay,
          "@media (max-width: 599.95px)": {
            width: "calc(100% - 24px)",
            margin: 12
          }
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: "20px 24px 12px",
          fontSize: typography.sectionTitle.fontSize,
          fontWeight: typography.sectionTitle.fontWeight,
          lineHeight: typography.sectionTitle.lineHeight
        }
      }
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          gap: 8,
          padding: "16px 24px 20px",
          flexWrap: "wrap",
          "& > :not(style) ~ :not(style)": {
            marginLeft: 0
          },
          "@media (max-width: 599.95px)": {
            alignItems: "stretch",
            flexDirection: "column-reverse",
            "& > *": {
              width: "100%"
            }
          }
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: `1px solid ${color.borderSubtle}`,
          backgroundColor: color.surfaceDefault
        }
      }
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true
      },
      styleOverrides: {
        tooltip: {
          borderRadius: radius.small,
          backgroundColor: color.surfaceInverse,
          color: color.textInverse,
          fontSize: typography.caption.fontSize,
          lineHeight: typography.caption.lineHeight
        },
        arrow: {
          color: color.surfaceInverse
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: color.borderSubtle,
          lineHeight: typography.compactBody.lineHeight,
          overflowWrap: "break-word",
          wordBreak: "normal",
          verticalAlign: "top"
        },
        head: {
          color: color.textPrimary,
          backgroundColor: color.surfaceSubtle,
          fontWeight: 800,
          overflowWrap: "normal",
          wordBreak: "normal",
          whiteSpace: "normal"
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: control.comfortableHeight
        },
        indicator: {
          height: 3
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: control.comfortableHeight,
          textTransform: "none",
          ...focusVisibleSx
        }
      }
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          minWidth: control.compactHeight,
          height: control.compactHeight,
          borderRadius: radius.small,
          ...focusVisibleSx
        }
      }
    },
    MuiSkeleton: {
      defaultProps: {
        animation: "pulse"
      },
      styleOverrides: {
        root: {
          borderRadius: radius.small,
          backgroundColor: color.surfaceEmphasized
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: color.link,
          fontWeight: 600,
          textUnderlineOffset: 3,
          "&:hover": {
            color: color.linkHover
          },
          ...focusVisibleSx
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: control.comfortableHeight,
          whiteSpace: "normal",
          ...focusVisibleSx
        }
      }
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: control.compactHeight,
          ...focusVisibleSx
        }
      }
    }
  }
});
