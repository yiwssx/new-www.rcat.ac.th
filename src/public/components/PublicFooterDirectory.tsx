import { Box, Container, Skeleton, Stack, Typography } from "@mui/material";
import { FooterDirectoryGroup } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { getEnabledFooterDirectoryGroups } from "./publicFooterDirectoryPolicy";
import { focusVisibleSx } from "../../design-system/componentStyles";
import { designTokens } from "../../design-system/tokens";

const footerDirectorySectionSx = {
  bgcolor: "primary.light",
  borderTop: "1px solid",
  borderColor: "divider",
  py: { xs: 3, md: 4 }
} as const;

const footerDirectoryGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
  gap: { xs: 2.5, md: 4 }
} as const;

const footerDirectoryHeadingSx = {
  color: "primary.dark",
  fontSize: { xs: "1rem", md: "1.08rem" },
  fontWeight: 900,
  mb: 1.25
} as const;

const footerDirectoryLinkSx = {
  color: "text.secondary",
  display: "inline-block",
  fontSize: { xs: "0.9rem", md: "0.94rem" },
  lineHeight: 1.55
} as const;

const footerDirectoryPlaceholderTitles = [
  "หน่วยงานส่วนกลาง สอศ.(สำนัก)",
  "หน่วยงานส่วนกลาง (ศูนย์/หน่วย/กลุ่ม)",
  "อาชีวศึกษาจังหวัดร้อยเอ็ด",
  "นโยบายการให้บริการ"
] as const;

function PlaceholderText({ width, height }: { width: string; height: number }) {
  return (
    <Typography
      component="div"
      sx={{
        position: "relative",
        ...footerDirectoryLinkSx
      }}
    >
      <Box component="span" sx={{ visibility: "hidden" }}>
        Placeholder
      </Box>
      <Skeleton
        variant="rounded"
        animation={false}
        width={width}
        height={height}
        sx={{
          bgcolor: "action.hover",
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)"
        }}
      />
    </Typography>
  );
}

function FooterDirectoryPlaceholder() {
  return (
    <Box
      component="section"
      data-cls-region="footer-directory"
      data-footer-directory-state="loading"
      data-footer-directory-columns="responsive-1-2-4"
      aria-hidden="true"
      sx={footerDirectorySectionSx}
    >
      <Container maxWidth="xl">
        <Box sx={footerDirectoryGridSx}>
          {footerDirectoryPlaceholderTitles.map((title, groupIndex) => (
            <Box key={title}>
              <Typography component="div" sx={{ ...footerDirectoryHeadingSx, position: "relative" }}>
                <Box component="span" sx={{ display: "block", visibility: "hidden" }}>
                  {title}
                </Box>
                <Skeleton
                  variant="rounded"
                  animation={false}
                  width={`${72 - groupIndex * 4}%`}
                  height={18}
                  sx={{
                    bgcolor: "action.selected",
                    position: "absolute",
                    top: 4
                  }}
                />
              </Typography>
              <Stack component="ul" spacing={0.7} sx={{ m: 0, p: 0, listStyle: "none" }}>
                {Array.from({ length: 7 }, (_, linkIndex) => (
                  <Box component="li" key={linkIndex}>
                    <PlaceholderText width={`${86 - ((groupIndex + linkIndex) % 4) * 8}%`} height={14} />
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export default function PublicFooterDirectory({
  groups,
  pending = false
}: {
  groups: FooterDirectoryGroup[];
  pending?: boolean;
}) {
  if (pending) {
    return <FooterDirectoryPlaceholder />;
  }

  const enabledGroups = getEnabledFooterDirectoryGroups(groups);

  if (!enabledGroups.length) {
    return (
      <Box
        component="section"
        data-cls-region="footer-directory"
        data-footer-directory-state="empty"
        data-footer-directory-columns="responsive-1-2-4"
        aria-hidden="true"
        hidden
      />
    );
  }

  return (
    <Box
      component="section"
      aria-label="ไดเรกทอรีลิงก์ส่วนท้ายเว็บไซต์"
      data-cls-region="footer-directory"
      data-footer-directory-state="ready"
      data-footer-directory-columns="responsive-1-2-4"
      sx={footerDirectorySectionSx}
    >
      <Container maxWidth="xl">
        <Box sx={footerDirectoryGridSx}>
          {enabledGroups.map((group) => (
            <Box key={group.title}>
              <Typography component="h2" sx={footerDirectoryHeadingSx}>
                {group.title}
              </Typography>
              <Stack component="ul" spacing={0.7} sx={{ m: 0, p: 0, listStyle: "none" }}>
                {group.links.map((link) => (
                  <Box component="li" key={link.label}>
                    <Typography
                      component="a"
                      href={normalizeSafeHref(link.href)}
                      aria-label={`เปิดลิงก์ ${link.label}`}
                      sx={{
                        ...footerDirectoryLinkSx,
                        textDecoration: "none",
                        transition: `color ${designTokens.motion.duration.standard}ms ${designTokens.motion.easing}`,
                        "&:hover": {
                          color: "primary.dark",
                          textDecoration: "underline",
                          textUnderlineOffset: "3px"
                        },
                        ...focusVisibleSx
                      }}
                    >
                      {link.label}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
