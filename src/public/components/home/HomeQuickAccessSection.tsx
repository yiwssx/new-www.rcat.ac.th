import { Box, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ContactPhoneOutlinedIcon from "@mui/icons-material/ContactPhoneOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import type { ReactNode } from "react";
import type { ExternalServiceLink, SiteSettings } from "../../../types";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { designTokens } from "../../../design-system/tokens";
import { focusVisibleSx } from "../../../design-system/componentStyles";

type QuickAccessItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: ReactNode;
};

function normalizeSearchText(value: string) {
  return String(value || "")
    .toLocaleLowerCase("th-TH")
    .replace(/\s+/g, " ")
    .trim();
}

function findExternalService(items: ExternalServiceLink[], keywords: string[]) {
  const normalizedKeywords = keywords.map(normalizeSearchText);

  return items.find((item) => {
    const haystack = normalizeSearchText(`${item.title} ${item.description}`);
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });
}

function getSafeQuickHref(href: string) {
  return href.startsWith("#") ? href : normalizeSafeHref(href);
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export function HomeQuickAccessSection({
  siteSettings,
  externalServices
}: {
  siteSettings: SiteSettings;
  externalServices: ExternalServiceLink[];
}) {
  const gradeService = findExternalService(externalServices, ["ผลการเรียน", "ผลการศึกษา", "grade"]);
  const studentSystemService = findExternalService(externalServices, ["ศธ.02", "ศธ 02", "ศธ02"]);

  const items: QuickAccessItem[] = [
    {
      id: "admission",
      label: "สมัครเรียน",
      description: "เริ่มต้นเส้นทางการเรียนกับ RCAT",
      href: siteSettings.admissionUrl || "/announcements",
      icon: <AssignmentOutlinedIcon />
    },
    gradeService
      ? {
          id: "grade",
          label: "ตรวจผลการเรียน",
          description: "เข้าระบบตรวจสอบผลการเรียน",
          href: gradeService.href,
          icon: <FactCheckOutlinedIcon />
        }
      : {
          id: "service",
          label: "บริการออนไลน์",
          description: "รวมระบบสำคัญสำหรับนักเรียนและบุคลากร",
          href: "#e-service",
          icon: <FactCheckOutlinedIcon />
        },
    studentSystemService
      ? {
          id: "student-system",
          label: "ระบบ ศธ.02",
          description: "เข้าสู่ระบบงานทะเบียนและข้อมูลการศึกษา",
          href: studentSystemService.href,
          icon: <DescriptionOutlinedIcon />
        }
      : {
          id: "documents",
          label: "เอกสารเผยแพร่",
          description: "ค้นหาแบบฟอร์มและเอกสารสำคัญ",
          href: "/documents",
          icon: <DescriptionOutlinedIcon />
        },
    {
      id: "news",
      label: "ข่าว / ประกาศ",
      description: "ติดตามข่าวสารและประกาศล่าสุด",
      href: "/announcements",
      icon: <CampaignOutlinedIcon />
    },
    {
      id: "departments",
      label: "หลักสูตรและแผนกวิชา",
      description: "สำรวจสาขาและเส้นทางการเรียน",
      href: "/departments",
      icon: <SchoolOutlinedIcon />
    },
    {
      id: "contact",
      label: "ติดต่อวิทยาลัย",
      description: "ข้อมูลติดต่อและช่องทางสอบถาม",
      href: "/contact",
      icon: <ContactPhoneOutlinedIcon />
    }
  ];

  return (
    <Box
      component="section"
      aria-label="ทางลัดบริการสำคัญ"
      sx={{
        position: "relative",
        zIndex: 4,
        mt: { xs: 2, md: -3.25 },
        px: { xs: 0, md: 2.5 }
      }}
    >
      <Box
        sx={(theme) => ({
          overflow: "hidden",
          borderRadius: `${designTokens.radius.large}px`,
          border: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.12),
          bgcolor: alpha(theme.palette.background.paper, 0.98),
          boxShadow: "0 18px 48px rgba(19, 69, 46, 0.12)",
          backdropFilter: "blur(14px)"
        })}
      >
        <Grid container>
          {items.map((item, index) => {
            const external = isExternalHref(item.href);

            return (
              <Grid size={{ xs: 6, sm: 4, lg: 2 }} key={item.id}>
                <Box
                  component="a"
                  href={getSafeQuickHref(item.href)}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  sx={(theme) => ({
                    ...focusVisibleSx,
                    minHeight: { xs: 128, md: 142 },
                    height: "100%",
                    px: { xs: 1.5, sm: 2, md: 2.25 },
                    py: { xs: 2, md: 2.4 },
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.8,
                    color: "text.primary",
                    textAlign: "center",
                    textDecoration: "none",
                    borderRight: {
                      xs: index % 2 === 0 ? `1px solid ${alpha(theme.palette.primary.main, 0.1)}` : "none",
                      sm: index % 3 !== 2 ? `1px solid ${alpha(theme.palette.primary.main, 0.1)}` : "none",
                      lg: index < items.length - 1 ? `1px solid ${alpha(theme.palette.primary.main, 0.1)}` : "none"
                    },
                    borderBottom: {
                      xs: index < 4 ? `1px solid ${alpha(theme.palette.primary.main, 0.1)}` : "none",
                      sm: index < 3 ? `1px solid ${alpha(theme.palette.primary.main, 0.1)}` : "none",
                      lg: "none"
                    },
                    transition: "background-color 160ms ease, transform 160ms ease, color 160ms ease",
                    "&:hover": {
                      bgcolor: alpha(theme.palette.primary.main, 0.055),
                      color: "primary.dark",
                      transform: "translateY(-2px)"
                    }
                  })}
                >
                  <Box
                    sx={(theme) => ({
                      width: 46,
                      height: 46,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      color: "primary.dark",
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      "& svg": { fontSize: 25 }
                    })}
                  >
                    {item.icon}
                  </Box>
                  <Stack spacing={0.35} sx={{ alignItems: "center", minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: { xs: "0.9rem", md: "0.98rem" }, lineHeight: 1.25 }}>
                      {item.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: { xs: "none", sm: "block" },
                        color: "text.secondary",
                        lineHeight: 1.4,
                        maxWidth: 170
                      }}
                    >
                      {item.description}
                    </Typography>
                  </Stack>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    </Box>
  );
}
