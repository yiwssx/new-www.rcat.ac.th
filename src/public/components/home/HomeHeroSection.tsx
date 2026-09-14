import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import PublicResponsiveImage from "../../../shared/media/PublicResponsiveImage";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { DirectorHeroCard } from "./DirectorHeroCard";
import { HomeQuickAccessSection } from "./HomeQuickAccessSection";
import { SiteSettings } from "../../../types";
import { designTokens } from "../../../design-system/tokens";

export function HomeHeroSection({ siteSettings }: { siteSettings: SiteSettings }) {
  const admissionHref = siteSettings.admissionUrl || "/announcements";

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(0, 1fr) minmax(250px, 290px)",
            lg: "minmax(0, 1fr) minmax(290px, 340px)"
          },
          gap: { xs: 2, md: 2.5 },
          alignItems: "stretch"
        }}
      >
        <Box
          component="section"
          aria-label="แนะนำวิทยาลัย"
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: `${designTokens.radius.large}px`,
            minHeight: { xs: 360, sm: 400, md: 420, lg: 460 },
            display: "flex",
            alignItems: "center",
            p: { xs: 2.5, sm: 3.5, md: 4.5, lg: 5.5 },
            color: "white",
            bgcolor: "primary.dark",
            boxShadow: designTokens.elevation.high
          }}
        >
          {siteSettings.heroImageUrl ? (
            <PublicResponsiveImage
              source={siteSettings.heroImageUrl}
              intent="hero"
              alt=""
              loadMode="near-viewport"
              nearViewportMargin="320px 0px"
              sizes="(max-width: 900px) 100vw, 72vw"
              fill
              reservedMinHeight={420}
              imageSx={{ objectFit: "cover", objectPosition: "center" }}
              sx={{ position: "absolute", inset: 0, zIndex: 0 }}
            />
          ) : null}

          <Box
            aria-hidden="true"
            sx={(theme) => ({
              position: "absolute",
              inset: 0,
              zIndex: 1,
              background: `linear-gradient(90deg, ${alpha(theme.palette.primary.dark, 0.98)} 0%, ${alpha(
                theme.palette.primary.dark,
                0.92
              )} 34%, ${alpha(theme.palette.primary.main, 0.72)} 62%, ${alpha(theme.palette.primary.dark, 0.2)} 100%)`
            })}
          />

          <Box
            aria-hidden="true"
            sx={(theme) => ({
              position: "absolute",
              inset: 0,
              zIndex: 2,
              background: `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.02)} 0%, ${alpha(
                theme.palette.common.black,
                0.36
              )} 100%)`
            })}
          />

          <Box
            aria-hidden="true"
            sx={(theme) => ({
              display: { xs: "none", md: "block" },
              position: "absolute",
              zIndex: 2,
              right: 40,
              top: 40,
              width: 180,
              height: 180,
              borderRadius: "50%",
              border: "1px solid",
              borderColor: alpha(theme.palette.common.white, 0.14),
              boxShadow: `0 0 0 28px ${alpha(theme.palette.common.white, 0.035)}`
            })}
          />

          <Box
            aria-hidden="true"
            sx={(theme) => ({
              display: { xs: "none", lg: "block" },
              position: "absolute",
              zIndex: 2,
              right: 56,
              bottom: 40,
              width: 112,
              height: 78,
              backgroundImage: `radial-gradient(${alpha(theme.palette.common.white, 0.4)} 1px, transparent 1px)`,
              backgroundSize: "12px 12px",
              opacity: 0.42
            })}
          />

          <Stack spacing={{ xs: 1.6, md: 2 }} sx={{ position: "relative", zIndex: 3, maxWidth: 720 }}>
            {siteSettings.heroChip ? (
              <Chip
                icon={<SchoolOutlinedIcon />}
                label={siteSettings.heroChip}
                sx={(theme) => ({
                  alignSelf: "flex-start",
                  height: 34,
                  px: 0.4,
                  bgcolor: alpha(theme.palette.common.white, 0.14),
                  color: "white",
                  border: "1px solid",
                  borderColor: alpha(theme.palette.common.white, 0.2),
                  fontWeight: 800,
                  "& .MuiChip-icon": {
                    color: "secondary.light"
                  }
                })}
              />
            ) : null}

            <Typography
              variant="h1"
              sx={{
                maxWidth: 700,
                fontSize: { xs: "2rem", sm: "2.7rem", md: "3rem", lg: "3.45rem" },
                fontWeight: 900,
                lineHeight: 1.03,
                letterSpacing: "-0.035em",
                textWrap: "balance"
              }}
            >
              {siteSettings.heroTitle}
            </Typography>

            {siteSettings.heroDescription ? (
              <Typography
                sx={(theme) => ({
                  maxWidth: 590,
                  color: alpha(theme.palette.common.white, 0.88),
                  fontSize: { xs: "0.98rem", sm: "1.05rem", md: "1.12rem" },
                  lineHeight: 1.65
                })}
              >
                {siteSettings.heroDescription}
              </Typography>
            ) : null}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              useFlexGap
              sx={{
                pt: 0.6,
                alignItems: { xs: "stretch", sm: "center" },
                flexWrap: "wrap"
              }}
            >
              <Button
                variant="contained"
                color="secondary"
                size="large"
                href={normalizeSafeHref(admissionHref)}
                startIcon={<AssignmentOutlinedIcon />}
                sx={{
                  px: 2.6,
                  minHeight: 46,
                  fontWeight: 900,
                  boxShadow: designTokens.elevation.medium
                }}
              >
                {siteSettings.admissionUrl ? "สมัครเรียน" : "ดูประกาศรับสมัคร"}
              </Button>

              <Button
                variant="outlined"
                size="large"
                href={normalizeSafeHref("/departments")}
                sx={(theme) => ({
                  minHeight: 46,
                  px: 2.4,
                  color: "white",
                  borderColor: alpha(theme.palette.common.white, 0.52),
                  bgcolor: alpha(theme.palette.common.black, 0.08),
                  fontWeight: 850,
                  "&:hover": {
                    borderColor: "white",
                    bgcolor: alpha(theme.palette.common.white, 0.1)
                  }
                })}
              >
                ดูหลักสูตรและแผนกวิชา
              </Button>

              <Button
                variant="text"
                size="large"
                href={normalizeSafeHref("/news")}
                endIcon={<ArrowForwardOutlinedIcon />}
                sx={{ color: "white", fontWeight: 850 }}
              >
                ข่าวล่าสุด
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ width: "100%", height: "100%", display: "flex" }}>
          <DirectorHeroCard siteSettings={siteSettings} />
        </Box>
      </Box>

      <HomeQuickAccessSection siteSettings={siteSettings} externalServices={[]} />
    </Box>
  );
}
