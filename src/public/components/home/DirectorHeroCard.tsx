import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import EmptyState from "../../../shared/components/EmptyState";
import PublicResponsiveImage from "../../../shared/media/PublicResponsiveImage";
import { SiteSettings } from "../../../types";
import { resolvePublicImageSource } from "../../../shared/media/publicImageSources";
import { designTokens } from "../../../design-system/tokens";

export function DirectorHeroCard({ siteSettings }: { siteSettings: SiteSettings }) {
  const directorImageUrl = resolvePublicImageSource(siteSettings.directorImageUrl, "portrait").src;
  const hasDirectorInfo = Boolean(
    siteSettings.directorName ||
    siteSettings.directorDescription ||
    siteSettings.directorTitle ||
    siteSettings.directorImageUrl
  );
  const directorImageAlt = siteSettings.directorName
    ? `รูปผู้บริหาร ${siteSettings.directorName}`
    : "รูปผู้บริหารสถานศึกษา";

  return (
    <Box
      component="section"
      sx={(theme) => ({
        height: "100%",
        width: "100%",
        overflow: "hidden",
        borderRadius: `${designTokens.radius.large}px`,
        border: "1px solid",
        borderColor: alpha(theme.palette.primary.main, 0.12),
        bgcolor: "background.paper",
        boxShadow: "0 18px 48px rgba(19, 69, 46, 0.1)"
      })}
    >
      {hasDirectorInfo ? (
        <Stack sx={{ height: "100%" }}>
          <Box sx={{ position: "relative", px: { xs: 3, md: 2.5 }, pt: { xs: 2.5, md: 3 }, pb: 1.25 }}>
            <Typography
              component="p"
              sx={{
                color: "primary.main",
                fontSize: "0.72rem",
                fontWeight: 900,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                textAlign: "center"
              }}
            >
              ผู้บริหารสถานศึกษา
            </Typography>
          </Box>

          <Box sx={{ px: { xs: 3.5, md: 2.8 }, display: "flex", justifyContent: "center" }}>
            {directorImageUrl ? (
              <PublicResponsiveImage
                source={siteSettings.directorImageUrl}
                intent="portrait"
                sizes="(max-width: 600px) 190px, (max-width: 900px) 210px, 230px"
                alt={directorImageAlt}
                loadMode="near-viewport"
                nearViewportMargin="160px 0px"
                aspectRatio="3 / 4"
                fill
                sx={(theme) => ({
                  width: { xs: 190, sm: 210, md: "100%" },
                  maxWidth: 230,
                  flex: "0 0 auto",
                  borderRadius: `${designTokens.radius.medium}px`,
                  overflow: "hidden",
                  bgcolor: alpha(theme.palette.primary.light, 0.4)
                })}
                imageSx={{
                  objectFit: "cover",
                  objectPosition: "center top"
                }}
              />
            ) : (
              <Box
                sx={(theme) => ({
                  width: { xs: 190, sm: 210, md: "100%" },
                  maxWidth: 230,
                  aspectRatio: "3 / 4",
                  borderRadius: `${designTokens.radius.medium}px`,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha(theme.palette.primary.light, 0.72)
                })}
              >
                <SchoolOutlinedIcon sx={{ fontSize: { xs: 58, md: 64 }, color: "primary.dark" }} />
              </Box>
            )}
          </Box>

          <Stack
            spacing={0.55}
            sx={{
              mt: "auto",
              px: { xs: 2.5, md: 2.25 },
              pt: 1.8,
              pb: { xs: 2.5, md: 2.75 },
              alignItems: "center",
              textAlign: "center"
            }}
          >
            <Typography variant="h2" sx={{ fontSize: { xs: "1rem", md: "1.08rem" }, color: "primary.dark" }}>
              {siteSettings.directorName || siteSettings.directorTitle || "ข้อมูลผู้บริหาร"}
            </Typography>
            {siteSettings.directorName && siteSettings.directorTitle ? (
              <Typography sx={{ color: "text.secondary", fontSize: "0.83rem", lineHeight: 1.45 }}>
                {siteSettings.directorTitle}
              </Typography>
            ) : null}
            {siteSettings.directorDescription ? (
              <Typography sx={{ color: "text.secondary", fontSize: "0.8rem", lineHeight: 1.5 }}>
                {siteSettings.directorDescription}
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      ) : (
        <Box sx={{ p: 2.5 }}>
          <EmptyState title="ยังไม่มีข้อมูลผู้บริหาร" icon={<SchoolOutlinedIcon />} />
        </Box>
      )}
    </Box>
  );
}
