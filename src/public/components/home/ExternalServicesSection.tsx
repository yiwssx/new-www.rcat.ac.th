import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { ExternalServiceLink, MediaAsset } from "../../../types";
import { getExternalServiceIconMediaId } from "../../../features/cms-external-services";
import { getExternalServiceIconSurfaceStyle } from "../../../utils/externalServiceTheme";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import PublicResponsiveImage from "../../../shared/media/PublicResponsiveImage";
import { resolvePublicImageSource } from "../../../shared/media/publicImageSources";
import { HomeSectionHeading } from "./HomeSectionHeading";
import { focusVisibleSx } from "./homeSectionStyles";
import { interactiveSurfaceSx } from "../../../design-system/componentStyles";
import { designTokens } from "../../../design-system/tokens";
import ExternalServiceIcon from "../../../design-system/icons/ExternalServiceIcon";

const MEDIA_ICON_SURFACE = getExternalServiceIconSurfaceStyle("media");
const LINK_ICON_SURFACE = getExternalServiceIconSurfaceStyle("link");

export function ExternalServicesSection({
  items,
  mediaAssets = []
}: {
  items: ExternalServiceLink[];
  mediaAssets?: MediaAsset[];
}) {
  if (items.length === 0) {
    return null;
  }

  const mediaById = new Map(mediaAssets.map((asset) => [asset.id, asset]));

  return (
    <Box component="section" sx={{ mt: { xs: 5, md: 7 } }}>
      <HomeSectionHeading
        label="บริการออนไลน์"
        title="E-Service สำหรับนักเรียนและบุคลากร"
        description="เข้าถึงระบบสำคัญของวิทยาลัยได้จากจุดเดียว"
      />
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: `${designTokens.radius.large}px`,
          minHeight: { xs: 122, md: 148 },
          mb: 2.5,
          px: { xs: 2.4, sm: 3, md: 3.5 },
          py: { xs: 2.2, md: 2.6 },
          display: "flex",
          alignItems: "center",
          background:
            "linear-gradient(135deg, var(--rcat-primary-hover) 0%, var(--rcat-primary) 70%, var(--rcat-secondary) 100%)",
          color: "white",
          boxShadow: designTokens.elevation.medium
        }}
      >
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            position: "absolute",
            right: { xs: -38, md: 52 },
            top: { xs: -54, md: -44 },
            width: { xs: 150, md: 190 },
            height: { xs: 150, md: 190 },
            borderRadius: "50%",
            border: "24px solid",
            borderColor: alpha(theme.palette.secondary.light, 0.2)
          })}
        />
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            position: "absolute",
            right: { xs: 42, md: 250 },
            bottom: -34,
            width: 96,
            height: 96,
            backgroundImage: `radial-gradient(${alpha(theme.palette.secondary.light, 0.68)} 1px, transparent 1px)`,
            backgroundSize: "12px 12px",
            opacity: 0.32
          })}
        />
        <Stack spacing={0.45} sx={{ position: "relative", zIndex: 1, maxWidth: 620 }}>
          <Typography
            component="p"
            sx={{
              color: "var(--rcat-accent-soft)",
              fontWeight: 900,
              fontSize: { xs: "0.76rem", md: "0.8rem" },
              letterSpacing: "0.04em",
              textTransform: "uppercase"
            }}
          >
            Online Service Portal
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: "2rem", sm: "2.35rem", md: "2.75rem" },
              lineHeight: 1,
              color: "var(--rcat-surface)"
            }}
          >
            E-Service
          </Typography>
          <Typography
            sx={(theme) => ({
              color: alpha(theme.palette.common.white, 0.88),
              fontSize: { xs: "0.9rem", md: "1rem" }
            })}
          >
            ระบบบริการออนไลน์ของวิทยาลัย
          </Typography>
        </Stack>
      </Box>
      <Grid container spacing={2}>
        {items.map((item) => {
          const iconMediaId = getExternalServiceIconMediaId(item.iconKey);
          const iconMediaAsset = iconMediaId ? mediaById.get(iconMediaId) : undefined;
          const iconImage = resolvePublicImageSource(iconMediaAsset, "tiny-thumbnail");
          const hasMediaIcon = Boolean(iconMediaAsset?.type === "image" && iconImage.src);
          const iconSurface = hasMediaIcon ? MEDIA_ICON_SURFACE : LINK_ICON_SURFACE;

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
                        data-external-service-icon-source={hasMediaIcon ? "media" : "link"}
                        sx={{
                          width: 48,
                          height: 48,
                          border: "1px solid",
                          borderColor: iconSurface.borderColor,
                          borderRadius: `${designTokens.radius.medium}px`,
                          display: "grid",
                          placeItems: "center",
                          color: iconSurface.color,
                          bgcolor: iconSurface.backgroundColor,
                          boxShadow: iconSurface.boxShadow,
                          overflow: "hidden",
                          "& svg": {
                            fontSize: 27
                          }
                        }}
                      >
                        {hasMediaIcon ? (
                          <PublicResponsiveImage
                            source={iconMediaAsset}
                            intent="tiny-thumbnail"
                            alt=""
                            loadMode="near-viewport"
                            intrinsic
                            width={44}
                            height={44}
                            sizes="48px"
                            fallback={
                              <Box
                                sx={{
                                  width: "100%",
                                  height: "100%",
                                  display: "grid",
                                  placeItems: "center",
                                  color: LINK_ICON_SURFACE.color,
                                  bgcolor: LINK_ICON_SURFACE.backgroundColor
                                }}
                              >
                                <ExternalServiceIcon iconKey="link" />
                              </Box>
                            }
                            sx={{ width: 44, height: 44 }}
                            imageSx={{ width: 44, height: 44, objectFit: "contain" }}
                          />
                        ) : (
                          <ExternalServiceIcon iconKey="link" />
                        )}
                      </Box>
                      <OpenInNewOutlinedIcon sx={{ color: "text.secondary", fontSize: 19 }} />
                    </Stack>
                    <Stack spacing={0.75} sx={{ flex: 1 }}>
                      <Typography variant="h3" sx={{ fontSize: "1rem", lineHeight: 1.32 }}>
                        {item.title}
                      </Typography>
                      {item.description ? (
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            lineHeight: 1.55
                          }}
                        >
                          {item.description}
                        </Typography>
                      ) : null}
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
