import { Box, Container, Skeleton, Stack, Typography } from "@mui/material";
import { FooterDirectoryGroup } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { getEnabledFooterDirectoryGroups } from "./publicFooterDirectoryPolicy";

const footerDirectorySectionSx = {
  bgcolor: "primary.light",
  borderTop: "1px solid rgba(31, 90, 44, 0.12)",
  py: { xs: 3, md: 4 }
} as const;

const footerDirectoryGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
  gap: { xs: 2.5, md: 4 }
} as const;

function FooterDirectoryPlaceholder() {
  return (
    <Box
      component="section"
      data-cls-region="footer-directory"
      data-footer-directory-state="loading"
      data-footer-directory-columns="responsive-1-2-4"
      aria-hidden="true"
      sx={{
        ...footerDirectorySectionSx,
        minHeight: { xs: 1051, sm: 560, lg: 302 }
      }}
    >
      <Container maxWidth="xl">
        <Box sx={footerDirectoryGridSx}>
          {Array.from({ length: 4 }, (_, groupIndex) => (
            <Stack key={groupIndex} spacing={0.9}>
              <Skeleton
                variant="rounded"
                animation={false}
                width={`${72 - groupIndex * 4}%`}
                height={26}
                sx={{ bgcolor: "rgba(31, 90, 44, 0.13)", mb: 0.35 }}
              />
              {Array.from({ length: 7 }, (_, linkIndex) => (
                <Skeleton
                  key={linkIndex}
                  variant="rounded"
                  animation={false}
                  width={`${86 - ((groupIndex + linkIndex) % 4) * 8}%`}
                  height={14}
                  sx={{ bgcolor: "rgba(31, 90, 44, 0.09)" }}
                />
              ))}
            </Stack>
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
              <Typography
                component="h2"
                sx={{
                  color: "primary.dark",
                  fontSize: { xs: "1rem", md: "1.08rem" },
                  fontWeight: 900,
                  mb: 1.25
                }}
              >
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
                        color: "text.secondary",
                        display: "inline-block",
                        fontSize: { xs: "0.9rem", md: "0.94rem" },
                        lineHeight: 1.55,
                        textDecoration: "none",
                        transition: "color 160ms ease",
                        "&:hover": {
                          color: "primary.dark",
                          textDecoration: "underline",
                          textUnderlineOffset: "3px"
                        },
                        "&:focus-visible": {
                          borderRadius: 0.5,
                          outline: "2px solid",
                          outlineColor: "secondary.main",
                          outlineOffset: 3
                        }
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
