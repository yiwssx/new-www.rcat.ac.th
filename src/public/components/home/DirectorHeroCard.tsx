import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import EmptyState from "../../../shared/components/EmptyState";
import PublicResponsiveImage from "../../../shared/media/PublicResponsiveImage";
import { SiteSettings } from "../../../types";
import { resolvePublicImageSource } from "../../../shared/media/publicImageSources";

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
      sx={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        bgcolor: "transparent",
        py: { xs: 1.5, md: 1 }
      }}
    >
      <Stack spacing={1.15} alignItems="center" sx={{ width: "100%" }}>
        <Box sx={{ width: "100%", textAlign: "center" }}>
          <Typography
            component="p"
            sx={{
              color: "secondary.dark",
              fontSize: "0.72rem",
              fontWeight: 800,
              letterSpacing: 0,
              textTransform: "uppercase"
            }}
          ></Typography>
          <Typography variant="h2" sx={{ fontSize: { xs: "1.05rem", md: "1.15rem" } }}>
            {siteSettings.directorTitle || "ข้อมูลผู้บริหาร"}
          </Typography>
        </Box>
        {hasDirectorInfo ? (
          <Stack spacing={1.15} alignItems="center" sx={{ width: "100%" }}>
            {directorImageUrl ? (
              <PublicResponsiveImage
                source={siteSettings.directorImageUrl}
                intent="portrait"
                sizes="(max-width: 600px) 160px, (max-width: 900px) 176px, 192px"
                alt={directorImageAlt}
                loadMode="near-viewport"
                nearViewportMargin="160px 0px"
                aspectRatio="3 / 4"
                fill
                sx={{
                  width: { xs: 160, sm: 176, md: 184, lg: 192 },
                  flex: "0 0 auto",
                  borderRadius: 1,
                  bgcolor: "background.default"
                }}
                imageSx={{
                  objectFit: "cover",
                  objectPosition: "center top"
                }}
              />
            ) : (
              <Box
                sx={(theme) => ({
                  width: { xs: 160, sm: 176, md: 184, lg: 192 },
                  flex: "0 0 auto",
                  aspectRatio: "3 / 4",
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha(theme.palette.primary.light, 0.82)
                })}
              >
                <SchoolOutlinedIcon sx={{ fontSize: { xs: 52, md: 58 }, color: "primary.dark" }} />
              </Box>
            )}
            <Stack spacing={0.45} alignItems="center" sx={{ width: "100%", textAlign: "center" }}>
              {siteSettings.directorName && (
                <Typography
                  variant="h3"
                  sx={{ fontSize: { xs: "0.98rem", md: "1.05rem" }, fontWeight: 900, lineHeight: 1.25 }}
                >
                  {siteSettings.directorName}
                </Typography>
              )}
              {siteSettings.directorDescription && (
                <Typography color="text.secondary" sx={{ fontSize: "0.82rem", lineHeight: 1.45 }}>
                  {siteSettings.directorDescription}
                </Typography>
              )}
            </Stack>
          </Stack>
        ) : (
          <EmptyState title="ยังไม่มีข้อมูลผู้บริหาร" icon={<SchoolOutlinedIcon />} />
        )}
      </Stack>
    </Box>
  );
}
