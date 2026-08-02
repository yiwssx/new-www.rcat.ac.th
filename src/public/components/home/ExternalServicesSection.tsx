import { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { ExternalServiceIconKey, ExternalServiceLink } from "../../../types";
import { getExternalServiceToneStyle } from "../../../utils/externalServiceTheme";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";
import { focusVisibleSx } from "./homeSectionStyles";
import { interactiveSurfaceSx } from "../../../design-system/componentStyles";
import { designTokens } from "../../../design-system/tokens";
import ExternalServiceIcon from "../../../design-system/icons/ExternalServiceIcon";

function getExternalServiceIcon(iconKey: ExternalServiceIconKey): ReactNode {
  return <ExternalServiceIcon iconKey={iconKey} />;
}

export function ExternalServicesSection({ items }: { items: ExternalServiceLink[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Box component="section" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <HomeSectionHeading
        label="E-Service"
        title="บริการออนไลน์และลิงก์ที่เกี่ยวข้อง"
        description="รวมระบบบริการออนไลน์และลิงก์สำคัญสำหรับนักเรียน นักศึกษา ผู้ปกครอง บุคลากร และผู้สนใจ"
      />
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: `${designTokens.radius.large}px`,
          minHeight: { xs: 160, md: 220 },
          mb: 2.5,
          p: { xs: 2.4, sm: 3, md: 4 },
          display: "flex",
          alignItems: "center",
          background:
            "linear-gradient(135deg, var(--rcat-primary-hover) 0%, var(--rcat-primary) 65%, var(--rcat-secondary) 100%)",
          color: "white",
          boxShadow: designTokens.elevation.medium
        }}
      >
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            position: "absolute",
            right: { xs: -44, md: 44 },
            top: { xs: -36, md: 28 },
            width: { xs: 150, md: 190 },
            height: { xs: 150, md: 190 },
            borderRadius: "50%",
            border: "26px solid",
            borderColor: alpha(theme.palette.secondary.main, 0.22)
          })}
        />
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            position: "absolute",
            right: { xs: 26, md: 228 },
            bottom: { xs: -28, md: 24 },
            width: 96,
            height: 96,
            borderRadius: `${designTokens.radius.large}px`,
            backgroundImage: `radial-gradient(${alpha(theme.palette.secondary.light, 0.72)} 1px, transparent 1px)`,
            backgroundSize: "12px 12px",
            opacity: 0.34
          })}
        />
        <Stack spacing={0.9} sx={{ position: "relative", zIndex: 1, maxWidth: 620 }}>
          <Typography
            component="p"
            sx={{
              color: "var(--rcat-accent-soft)",
              fontWeight: 900,
              letterSpacing: 0,
              textTransform: "uppercase"
            }}
          >
            Online Service Portal
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: "2.55rem", sm: "3.35rem", md: "4.5rem" },
              lineHeight: 0.95,
              color: "var(--rcat-surface)"
            }}
          >
            E-Service
          </Typography>
          <Typography
            sx={(theme) => ({ color: alpha(theme.palette.common.white, 0.9), fontSize: { xs: "1rem", md: "1.18rem" } })}
          >
            ระบบบริการออนไลน์
          </Typography>
        </Stack>
      </Box>
      <Grid container spacing={2}>
        {items.map((item) => {
          const toneStyle = getExternalServiceToneStyle(item.tone);

          return (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.id}>
              <Card
                component="a"
                href={normalizeSafeHref(item.href)}
                target="_blank"
                rel="noreferrer"
                aria-label={`เปิดลิงก์บริการ ${item.title}`}
                sx={{
                  ...interactiveSurfaceSx,
                  height: "100%",
                  display: "block",
                  textDecoration: "none",
                  ...focusVisibleSx,
                  "&:hover": {
                    transform: "translateY(-3px)",
                    borderColor: "primary.main",
                    ...interactiveSurfaceSx["&:hover"]
                  }
                }}
              >
                <CardContent sx={{ height: "100%", p: 1.8 }}>
                  <Stack spacing={1.35} sx={{ height: "100%" }}>
                    <Stack
                      direction="row"
                      spacing={1.1}
                      sx={{
                        alignItems: "flex-start",
                        justifyContent: "space-between"
                      }}
                    >
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: `${designTokens.radius.medium}px`,
                          display: "grid",
                          placeItems: "center",
                          color: toneStyle.iconColor,
                          bgcolor: toneStyle.iconBg,
                          boxShadow: designTokens.elevation.low,
                          "& svg": {
                            fontSize: 27
                          }
                        }}
                      >
                        {getExternalServiceIcon(item.iconKey)}
                      </Box>
                      <OpenInNewOutlinedIcon sx={{ color: "text.secondary", fontSize: 19 }} />
                    </Stack>
                    <Stack spacing={0.75} sx={{ flex: 1 }}>
                      <Typography variant="h3" sx={{ fontSize: "1rem", lineHeight: 1.32 }}>
                        {item.title}
                      </Typography>
                      {item.description && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            lineHeight: 1.55
                          }}
                        >
                          {item.description}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
