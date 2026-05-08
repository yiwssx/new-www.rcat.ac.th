import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { DirectorHeroCard } from "./DirectorHeroCard";
import { SiteSettings } from "../../../types";

export function HomeHeroSection({ siteSettings }: { siteSettings: SiteSettings }) {
  const heroImageLayer = siteSettings.heroImageUrl ? `, url(${JSON.stringify(siteSettings.heroImageUrl)})` : "";

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(0, 1fr) minmax(240px, 280px)",
          lg: "minmax(0, 1fr) minmax(300px, 360px)"
        },
        gap: { xs: 2, md: 3 },
        alignItems: "stretch"
      }}
    >
      <Box
        component="section"
        sx={(theme) => ({
          position: "relative",
          overflow: "hidden",
          borderRadius: 1,
          height: "100%",
          minHeight: { xs: 240, sm: 240, md: 240, lg: 240 },
          display: "flex",
          alignItems: "center",
          p: { xs: 2, sm: 2.5, md: 3.5 },
          color: "white",
          backgroundImage: `linear-gradient(120deg, ${alpha(theme.palette.primary.dark, 0.94)} 0%, ${alpha(
            theme.palette.primary.main,
            0.84
          )} 56%, ${alpha(theme.palette.secondary.dark, 0.58)} 100%)${heroImageLayer}`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: "0 18px 34px rgba(31, 90, 44, 0.16)"
        })}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(12, 34, 14, 0.04) 0%, rgba(12, 34, 14, 0.42) 100%)"
          }}
        />

        <Box
          aria-hidden="true"
          sx={{
            display: { xs: "none", md: "block" },
            position: "absolute",
            right: 44,
            top: 34,
            width: 210,
            height: 210,
            borderRadius: "50%",
            bgcolor: "rgba(255, 255, 255, 0.055)",
            border: "1px solid rgba(255, 255, 255, 0.12)"
          }}
        />

        <Box
          aria-hidden="true"
          sx={{
            display: { xs: "none", lg: "block" },
            position: "absolute",
            right: 108,
            bottom: -36,
            width: 150,
            height: 150,
            borderRadius: "50%",
            bgcolor: "rgba(255, 255, 255, 0.045)"
          }}
        />

        <Stack spacing={{ xs: 1.35, md: 1.6 }} sx={{ position: "relative", zIndex: 1, maxWidth: 620 }}>
          {siteSettings.heroChip && (
            <Chip
              icon={<SchoolOutlinedIcon />}
              label={siteSettings.heroChip}
              sx={{
                alignSelf: "flex-start",
                bgcolor: "rgba(255, 255, 255, 0.14)",
                color: "white",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                "& .MuiChip-icon": {
                  color: "secondary.main"
                }
              }}
            />
          )}

          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "1.75rem", sm: "2.1rem", md: "2.2rem", lg: "2.55rem" },
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.02em"
            }}
          >
            {siteSettings.heroTitle}
          </Typography>

          {siteSettings.heroDescription && (
            <Typography
              sx={{
                maxWidth: 520,
                color: "rgba(255, 255, 255, 0.84)",
                fontSize: { xs: "0.92rem", md: "1rem" },
                lineHeight: 1.55
              }}
            >
              {siteSettings.heroDescription}
            </Typography>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ xs: "stretch", sm: "center" }}>
            {siteSettings.admissionUrl && (
              <Button
                variant="contained"
                color="error"
                size="medium"
                href={normalizeSafeHref(siteSettings.admissionUrl)}
                startIcon={<AssignmentIcon />}
              >
                สมัครเรียน
              </Button>
            )}

            <Button
              variant="outlined"
              size="medium"
              href={normalizeSafeHref("/announcements")}
              sx={{
                color: "white",
                borderColor: "rgba(255, 255, 255, 0.34)"
              }}
            >
              ประกาศ
            </Button>

            <Button
              variant="text"
              size="medium"
              href={normalizeSafeHref("/news")}
              endIcon={<ArrowForwardOutlinedIcon />}
              sx={{ color: "white" }}
            >
              ข่าวสาร
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ width: "100%", height: "100%", display: "flex" }}>
        <DirectorHeroCard siteSettings={siteSettings} />
      </Box>
    </Box>
  );
}
