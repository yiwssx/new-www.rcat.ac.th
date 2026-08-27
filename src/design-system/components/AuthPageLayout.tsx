import type { ReactNode } from "react";
import { Box, Card, CardContent, Container, Stack, Typography } from "@mui/material";
import { getCmsSiteName, projectSettings } from "../../config/projectSettings";

export interface AuthPageLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  showBrand?: boolean;
}

export default function AuthPageLayout({ title, description, children, showBrand = false }: AuthPageLayoutProps) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.primary.light} 54%, ${theme.palette.secondary.light} 100%)`,
        px: 2,
        py: 5
      }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2.5}>
              {showBrand ? (
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{
                    alignItems: "center"
                  }}
                >
                  <Box
                    component="img"
                    src={projectSettings.site.logoPath}
                    alt={projectSettings.site.logoAlt}
                    sx={{
                      width: { xs: 56, sm: 64 },
                      height: { xs: 56, sm: 64 },
                      objectFit: "contain",
                      flex: "0 0 auto"
                    }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h1" sx={{ overflowWrap: "anywhere" }}>
                      {getCmsSiteName()}
                    </Typography>
                    <Typography
                      sx={{
                        color: "text.secondary"
                      }}
                    >
                      ระบบบริหารจัดการเนื้อหา
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Box>
                  <Typography variant="h1" sx={{ overflowWrap: "anywhere" }}>
                    {title}
                  </Typography>
                  {description ? (
                    <Typography
                      sx={{
                        color: "text.secondary",
                        mt: 0.75
                      }}
                    >
                      {description}
                    </Typography>
                  ) : null}
                </Box>
              )}
              {children}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
