import { Box, Button, Chip, CssBaseline, Stack, ThemeProvider } from "@mui/material";
import { createRoot } from "react-dom/client";
import { designTokens } from "../../../src/design-system/tokens";
import { theme } from "../../../src/theme";

const focusSurfaces = [
  ["page", designTokens.color.pageCanvas],
  ["paper", designTokens.color.surfaceDefault],
  ["primary", designTokens.color.brandPrimary],
  ["primary-strong", designTokens.color.brandPrimaryStrong],
  ["accent", designTokens.color.brandAccent],
  ["inverse", designTokens.color.surfaceInverse]
] as const;

function DesignSystemHarness() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Stack spacing={3} sx={{ minHeight: "100vh", p: 4, bgcolor: "background.default" }}>
        <Stack direction="row" gap={2} data-testid="focus-surfaces" sx={{ flexWrap: "wrap" }}>
          {focusSurfaces.map(([name, backgroundColor]) => (
            <Box
              key={name}
              component="button"
              type="button"
              data-testid={`focus-${name}`}
              sx={{
                width: 124,
                minHeight: 48,
                border: 0,
                borderRadius: 1,
                bgcolor: backgroundColor,
                color:
                  name === "page" || name === "paper" || name === "accent"
                    ? designTokens.color.textPrimary
                    : designTokens.color.textInverse
              }}
            >
              {name}
            </Box>
          ))}
        </Stack>

        <Stack
          direction="row"
          gap={2}
          data-testid="secondary-controls"
          sx={{ p: 2, bgcolor: "background.paper", flexWrap: "wrap", alignItems: "center" }}
        >
          <Button color="secondary" variant="contained">
            Secondary contained
          </Button>
          <Button color="secondary" variant="outlined">
            Secondary outlined
          </Button>
          <Button color="secondary" variant="text">
            Secondary text
          </Button>
          <Chip color="secondary" variant="outlined" label="Secondary outlined chip" onClick={() => undefined} />
        </Stack>
      </Stack>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(<DesignSystemHarness />);
