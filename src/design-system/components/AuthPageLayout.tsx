import type { ReactNode } from "react";
import { Box, Card, CardContent, Container, Stack, Typography } from "@mui/material";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { getCmsSiteName } from "../../config/projectSettings";

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
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      color: "primary.main",
                      backgroundColor: "primary.light",
                      flex: "0 0 auto"
                    }}
                  >
                    <SchoolOutlinedIcon aria-hidden="true" />
                  </Box>
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
