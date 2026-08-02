import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

import FaxOutlinedIcon from "@mui/icons-material/FaxOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineOutlinedIcon from "@mui/icons-material/MailOutlineOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";

import EmptyState from "../../shared/components/EmptyState";
import PublicDeferredEmbed from "../../shared/media/PublicDeferredEmbed";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { normalizeSafeHref, normalizeSafeResourceUrl } from "../../utils/safeUrl";
import PublicSiteShell from "../components/PublicSiteShell";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState from "../components/PublicLoadingState";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";
import { focusVisibleSx } from "../../design-system/componentStyles";
import SocialBrandIcon, { type SocialPlatform } from "../../design-system/icons/SocialBrandIcon";

function LargeMapCard({ mapUrl, mapEmbedUrl }: { mapUrl: string; mapEmbedUrl: string }) {
  const mapEmbedSrc = normalizeSafeResourceUrl(mapEmbedUrl);
  const mapHref = normalizeSafeHref(mapUrl);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 3, height: "100%" }}>
        <Typography variant="h3">แผนที่</Typography>
        {mapEmbedSrc ? (
          <>
            <PublicDeferredEmbed
              src={mapEmbedSrc}
              title="แผนที่วิทยาลัย"
              loadMode="near-viewport"
              nearViewportMargin="480px 0px"
              referrerPolicy="no-referrer-when-downgrade"
              sx={{
                width: "100%",
                height: { xs: 300, md: 420 },
                borderRadius: 1,
                display: "block",
                mt: 2
              }}
            />
            {mapHref !== "#" && (
              <Button
                component="a"
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                variant="text"
                startIcon={<MapOutlinedIcon />}
                endIcon={<OpenInNewOutlinedIcon />}
                aria-label="เปิดแผนที่ใน Google Maps"
                sx={{ mt: 1.5, ...focusVisibleSx }}
              >
                เปิดใน Google Maps
              </Button>
            )}
          </>
        ) : mapHref !== "#" ? (
          <Box
            sx={{
              mt: 2,
              minHeight: { xs: 300, md: 420 },
              borderRadius: 1,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              bgcolor: "background.default",
              border: "1px solid",
              borderColor: "divider",
              p: 3
            }}
          >
            <Stack
              spacing={1.8}
              sx={{
                alignItems: "center"
              }}
            >
              <MapOutlinedIcon sx={{ fontSize: 58, color: "primary.main" }} />
              <Typography
                sx={{
                  fontWeight: 900
                }}
              >
                ยังไม่ได้ตั้งค่าแผนที่แบบฝัง
              </Typography>
              <Button
                component="a"
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                startIcon={<MapOutlinedIcon />}
                endIcon={<OpenInNewOutlinedIcon />}
                aria-label="เปิดแผนที่ใน Google Maps"
                sx={focusVisibleSx}
              >
                เปิดใน Google Maps
              </Button>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            <EmptyState title="ยังไม่มีข้อมูลแผนที่" icon={<MapOutlinedIcon />} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function PublicContactPage() {
  const { data, isFetching, isError, refetch } = usePublicCmsSnapshot();

  if (!data) {
    return (
      <PublicSiteShell title="ติดต่อ" description="ข้อมูลติดต่อที่เผยแพร่จาก CMS">
        {isError ? (
          <PublicErrorState
            onRetry={() => {
              void refetch();
            }}
            isRetrying={isFetching}
          />
        ) : (
          <PublicLoadingState variant="simple" />
        )}
      </PublicSiteShell>
    );
  }

  const siteSettings = normalizeSiteSettings(data.siteSettings);
  const contactRows = [
    {
      label: "ที่อยู่",
      value: [siteSettings.campus, siteSettings.address].filter(Boolean).join("\n"),
      icon: <LocationOnOutlinedIcon color="primary" />
    },
    {
      label: "โทรศัพท์",
      value: siteSettings.phone,
      icon: <LocalPhoneOutlinedIcon color="primary" />
    },
    {
      label: "โทรสาร",
      value: siteSettings.fax,
      icon: <FaxOutlinedIcon color="primary" />
    },
    {
      label: "อีเมล",
      value: siteSettings.email,
      icon: <MailOutlineOutlinedIcon color="primary" />
    }
  ].filter((item) => item.value);
  const socialLinks: Array<{ label: string; href: string; platform: SocialPlatform }> = [];

  if (siteSettings.facebookUrl) {
    socialLinks.push({
      label: "Facebook",
      href: siteSettings.facebookUrl,
      platform: "facebook"
    });
  }

  if (siteSettings.youtubeUrl) {
    socialLinks.push({
      label: "YouTube",
      href: siteSettings.youtubeUrl,
      platform: "youtube"
    });
  }

  if (siteSettings.tiktokUrl) {
    socialLinks.push({
      label: "TikTok",
      href: siteSettings.tiktokUrl,
      platform: "tiktok"
    });
  }

  return (
    <PublicSiteShell title="ติดต่อ" description="ข้อมูลติดต่อที่เผยแพร่จาก CMS">
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h3">ข้อมูลติดต่อ</Typography>
                {contactRows.length ? (
                  <Stack spacing={2.2} sx={{ mt: 2 }}>
                    {contactRows.map((item) => (
                      <Stack
                        key={item.label}
                        direction="row"
                        spacing={1.4}
                        sx={{
                          alignItems: "flex-start"
                        }}
                      >
                        {item.icon}
                        <Box>
                          <Typography
                            sx={{
                              fontWeight: 900
                            }}
                          >
                            {item.label}
                          </Typography>
                          <Typography
                            sx={{
                              color: "text.secondary",
                              whiteSpace: "pre-line"
                            }}
                          >
                            {item.value}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Box sx={{ mt: 2 }}>
                    <EmptyState title="ยังไม่มีข้อมูลติดต่อ" icon={<LocationOnOutlinedIcon />} />
                  </Box>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h3">ช่องทางติดตาม</Typography>
                {socialLinks.length ? (
                  <Stack direction={{ xs: "column", sm: "row", lg: "column" }} spacing={1.2} sx={{ mt: 2 }}>
                    {socialLinks.map((item) => (
                      <Button
                        key={item.label}
                        component="a"
                        href={normalizeSafeHref(item.href)}
                        aria-label={item.label}
                        variant="outlined"
                        startIcon={<SocialBrandIcon platform={item.platform} />}
                        sx={{ justifyContent: "flex-start", ...focusVisibleSx }}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </Stack>
                ) : (
                  <Box sx={{ mt: 2 }}>
                    <EmptyState title="ยังไม่มีช่องทางติดตามที่เผยแพร่" />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <LargeMapCard mapUrl={siteSettings.mapUrl} mapEmbedUrl={siteSettings.mapEmbedUrl} />
        </Grid>
      </Grid>
    </PublicSiteShell>
  );
}
