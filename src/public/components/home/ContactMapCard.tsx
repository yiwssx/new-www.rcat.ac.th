import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import FaxOutlinedIcon from "@mui/icons-material/FaxOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { SiteSettings } from "../../../types";
import { normalizeSafeHref, normalizeSafeResourceUrl } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";
import { focusVisibleSx } from "./homeSectionStyles";

export function ContactMapCard({ siteSettings }: { siteSettings: SiteSettings }) {
  const hasContactInfo = Boolean(
    siteSettings.campus || siteSettings.address || siteSettings.phone || siteSettings.fax || siteSettings.email
  );
  const mapEmbedSrc = normalizeSafeResourceUrl(siteSettings.mapEmbedUrl);
  const mapHref = normalizeSafeHref(siteSettings.mapUrl);
  const mapTitle = `แผนที่${siteSettings.campus || siteSettings.siteName || "สถานศึกษา"}`;

  if (!hasContactInfo && !mapEmbedSrc && mapHref === "#") {
    return null;
  }

  return (
    <Card component="section" id="contact" sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <HomeSectionHeading label="ติดต่อ" title="ติดต่อและแผนที่" />
        {hasContactInfo && (
          <Stack spacing={1.15} sx={{ mb: mapEmbedSrc ? 1.8 : 0 }}>
            {(siteSettings.campus || siteSettings.address) && (
              <Stack direction="row" spacing={1.1} alignItems="flex-start">
                <LocationOnOutlinedIcon color="primary" fontSize="small" sx={{ mt: 0.2, flexShrink: 0 }} />
                <Typography
                  color="text.secondary"
                  variant="body2"
                  sx={{
                    whiteSpace: "pre-line",
                    lineHeight: 1.55,
                    minWidth: 0
                  }}
                >
                  {[siteSettings.campus, siteSettings.address].filter(Boolean).join("\n")}
                </Typography>
              </Stack>
            )}

            {(siteSettings.phone || siteSettings.fax) && (
              <Stack direction={{ xs: "row", sm: "row" }} spacing={1.4} useFlexGap flexWrap="wrap" alignItems="center">
                {siteSettings.phone && (
                  <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0, flex: "0 1 auto" }}>
                    <LocalPhoneOutlinedIcon color="primary" fontSize="small" sx={{ flexShrink: 0 }} />
                    <Typography color="text.secondary" variant="body2" noWrap>
                      {siteSettings.phone}
                    </Typography>
                  </Stack>
                )}

                {siteSettings.fax && (
                  <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0, flex: "0 1 auto" }}>
                    <FaxOutlinedIcon color="primary" fontSize="small" sx={{ flexShrink: 0 }} />
                    <Typography color="text.secondary" variant="body2" noWrap>
                      {siteSettings.fax}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            )}

            {siteSettings.email && (
              <Stack direction="row" spacing={1.1} alignItems="center">
                <MailOutlineRoundedIcon color="primary" fontSize="small" sx={{ flexShrink: 0 }} />
                <Typography
                  color="text.secondary"
                  variant="body2"
                  sx={{
                    minWidth: 0,
                    overflowWrap: "anywhere"
                  }}
                >
                  {siteSettings.email}
                </Typography>
              </Stack>
            )}
          </Stack>
        )}
        {mapEmbedSrc && (
          <Box
            component="iframe"
            src={mapEmbedSrc}
            title={mapTitle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sx={{
              width: "100%",
              height: { xs: 190, md: 210 },
              border: 0,
              borderRadius: 2,
              display: "block",
              mt: hasContactInfo ? 1.2 : 0
            }}
          />
        )}
        {!mapEmbedSrc && mapHref !== "#" && (
          <Typography color="text.secondary" variant="body2" sx={{ mt: hasContactInfo ? 1.2 : 0 }}>
            เปิดแผนที่ใน Google Maps เพื่อดูเส้นทาง
          </Typography>
        )}
        {mapHref !== "#" && (
          <Button
            component="a"
            href={mapHref}
            target="_blank"
            rel="noreferrer"
            variant={mapEmbedSrc ? "text" : "outlined"}
            startIcon={<MapOutlinedIcon />}
            endIcon={<OpenInNewOutlinedIcon />}
            fullWidth
            aria-label="เปิดแผนที่ใน Google Maps"
            sx={{
              justifyContent: "space-between",
              mt: mapEmbedSrc || hasContactInfo ? 1 : 0,
              ...focusVisibleSx
            }}
          >
            เปิดใน Google Maps
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
