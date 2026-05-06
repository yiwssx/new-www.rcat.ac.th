import { alpha, createTheme } from "@mui/material/styles";
import { projectSettings } from "./config/projectSettings";

const { palette, shape, typography } = projectSettings.theme;

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: palette.primaryMain,
      light: palette.primaryLight,
      dark: palette.primaryDark,
      contrastText: palette.paper
    },
    secondary: {
      main: palette.secondaryMain,
      light: palette.secondaryLight,
      dark: palette.secondaryDark,
      contrastText: palette.paper
    },
    success: {
      main: palette.successMain,
      light: palette.successLight,
      dark: palette.successDark
    },
    warning: {
      main: palette.warningMain,
      light: palette.warningLight,
      dark: palette.warningDark,
      contrastText: palette.paper
    },
    error: {
      main: palette.errorMain,
      light: palette.errorLight,
      dark: palette.errorDark
    },
    background: {
      default: palette.backgroundDefault,
      paper: palette.paper
    },
    text: {
      primary: palette.textPrimary,
      secondary: palette.textSecondary
    }
  },
  shape: {
    borderRadius: shape.borderRadius
  },
  typography: {
    fontFamily: typography.fontFamily.join(","),
    h1: {
      fontSize: "2.35rem",
      fontWeight: 800,
      lineHeight: 1.14
    },
    h2: {
      fontSize: "1.9rem",
      fontWeight: 800,
      lineHeight: 1.16
    },
    h3: {
      fontSize: "1.35rem",
      fontWeight: 700,
      lineHeight: 1.2
    },
    button: {
      textTransform: "none",
      fontWeight: 700
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: "none"
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha(palette.primaryDark, 0.12)}`,
          boxShadow: `0 12px 30px ${alpha(palette.primaryDark, 0.08)}`
        }
      }
    }
  }
});
