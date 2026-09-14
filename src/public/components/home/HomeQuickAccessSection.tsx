import { Box, Typography } from "@mui/material";
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
        zIndex: 1
      }}
    >
      <Box
        sx={(theme) => ({
          overflow: "hidden",
          borderRadius: `${designTokens.radius.medium}px`,
          border: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.11),
          bgcolor: "background.paper",
          boxShadow: designTokens.elevation.low
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
                  title={item.description}
                  sx={(theme) => ({
                    ...focusVisibleSx,
                    minHeight: { xs: 78, sm: 82, md: 86 },
                    height: "100%",
                    px: { xs: 0.75, sm: 1, md: 1.2 },
                    py: { xs: 0.8, md: 0.9 },
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.55,
                    color: "text.primary",
                    textAlign: "center",
                    textDecoration: "none",
                    borderRight: {
                      xs: index % 2 === 0 ? `1px solid ${alpha(theme.palette.primary.main, 0.09)}` : "none",
                      sm: index % 3 !== 2 ? `1px solid ${alpha(theme.palette.primary.main, 0.09)}` : "none",
                      lg: index < items.length - 1 ? `1px solid ${alpha(theme.palette.primary.main, 0.09)}` : "none"
                    },
                    borderBottom: {
                      xs: index < 4 ? `1px solid ${alpha(theme.palette.primary.main, 0.09)}` : "none",
                      sm: index < 3 ? `1px solid ${alpha(theme.palette.primary.main, 0.09)}` : "none",
                      lg: "none"
                    },
                    transition: "background-color 160ms ease, color 160ms ease",
                    "&:hover": {
                      bgcolor: alpha(theme.palette.primary.main, 0.045),
                      color: "primary.dark"
                    }
                  })}
                >
                  <Box
                    sx={(theme) => ({
                      width: { xs: 32, md: 34 },
                      height: { xs: 32, md: 34 },
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      color: "primary.dark",
                      bgcolor: alpha(theme.palette.primary.main, 0.085),
                      "& svg": { fontSize: { xs: 18, md: 19 } }
                    })}
                  >
                    {item.icon}
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: 850,
                      fontSize: { xs: "0.76rem", sm: "0.8rem", md: "0.84rem" },
                      lineHeight: 1.2,
                      textWrap: "balance"
                    }}
                  >
                    {item.label}
                  </Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    </Box>
  );
}
