import { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { ExternalServiceIconKey, ExternalServiceLink } from "../../../types";
import { getExternalServiceToneStyle } from "../../../utils/externalServiceTheme";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";
import { focusVisibleSx } from "./homeSectionStyles";

function getExternalServiceIcon(iconKey: ExternalServiceIconKey): ReactNode {
  const icons: Record<ExternalServiceIconKey, ReactNode> = {
    apps: <AppsOutlinedIcon />,
    calendar: <CalendarMonthOutlinedIcon />,
    check: <FactCheckOutlinedIcon />,
    groups: <GroupsOutlinedIcon />,
    handshake: <HandshakeOutlinedIcon />,
    registration: <HowToRegOutlinedIcon />,
    book: <MenuBookOutlinedIcon />,
    school: <SchoolOutlinedIcon />,
    link: <LinkOutlinedIcon />
  };

  return icons[iconKey] ?? icons.link;
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
          borderRadius: 2,
          minHeight: { xs: 160, md: 220 },
          mb: 2.5,
          p: { xs: 2.4, sm: 3, md: 4 },
          display: "flex",
          alignItems: "center",
          background:
            "linear-gradient(135deg, var(--rcat-primary-hover) 0%, var(--rcat-primary) 65%, var(--rcat-secondary) 100%)",
          color: "white",
          boxShadow: "var(--rcat-shadow-md)"
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            right: { xs: -44, md: 44 },
            top: { xs: -36, md: 28 },
            width: { xs: 150, md: 190 },
            height: { xs: 150, md: 190 },
            borderRadius: "50%",
            border: "26px solid rgba(234, 179, 8, 0.22)"
          }}
        />
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            right: { xs: 26, md: 228 },
            bottom: { xs: -28, md: 24 },
            width: 96,
            height: 96,
            borderRadius: 3,
            backgroundImage: "radial-gradient(rgba(254, 249, 195, 0.72) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
            opacity: 0.34
          }}
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
            variant="h1"
            sx={{
              fontSize: { xs: "2.55rem", sm: "3.35rem", md: "4.5rem" },
              lineHeight: 0.95,
              color: "var(--rcat-surface)"
            }}
          >
            E-Service
          </Typography>
          <Typography sx={{ color: "rgba(255, 255, 255, 0.9)", fontSize: { xs: "1rem", md: "1.18rem" } }}>
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
                  height: "100%",
                  display: "block",
                  textDecoration: "none",
                  border: "1px solid var(--rcat-border)",
                  bgcolor: "var(--rcat-surface)",
                  boxShadow: "var(--rcat-shadow-sm)",
                  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                  ...focusVisibleSx,
                  "&:hover": {
                    transform: "translateY(-3px)",
                    borderColor: "rgba(22, 101, 52, 0.35)",
                    boxShadow: "0 16px 30px rgba(15, 23, 42, 0.1)"
                  }
                }}
              >
                <CardContent sx={{ height: "100%", p: 1.8 }}>
                  <Stack spacing={1.35} sx={{ height: "100%" }}>
                    <Stack direction="row" spacing={1.1} alignItems="flex-start" justifyContent="space-between">
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          display: "grid",
                          placeItems: "center",
                          color: toneStyle.iconColor,
                          bgcolor: toneStyle.iconBg,
                          boxShadow: "0 10px 20px rgba(22, 101, 52, 0.18)",
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
                        <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.55 }}>
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
