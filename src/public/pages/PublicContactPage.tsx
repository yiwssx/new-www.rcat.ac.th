import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import FacebookRoundedIcon from "@mui/icons-material/FacebookRounded";
import FaxOutlinedIcon from "@mui/icons-material/FaxOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import YouTubeIcon from "@mui/icons-material/YouTube";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTiktok } from "@fortawesome/free-brands-svg-icons";
import EmptyState from "../../shared/components/EmptyState";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { normalizeSafeHref } from "../../utils/safeUrl";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

export default function PublicContactPage() {
  const { data } = usePublicCmsSnapshot();
  const siteSettings = normalizeSiteSettings(data?.siteSettings);
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
      icon: <MailOutlineRoundedIcon color="primary" />
    }
  ].filter((item) => item.value);
  const socialLinks = [
    {
      label: "Facebook",
      href: siteSettings.facebookUrl,
      icon: <FacebookRoundedIcon />
    },
    {
      label: "YouTube",
      href: siteSettings.youtubeUrl,
      icon: <YouTubeIcon />
    },
    {
      label: "TikTok",
      href: siteSettings.tiktokUrl,
      icon: <FontAwesomeIcon icon={faTiktok} />
    }
  ].filter((item) => item.href);

  return (
    <PublicSiteShell
      title="ติดต่อ"
      description="ข้อมูลติดต่อที่เผยแพร่จาก CMS"
    >
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h3">ข้อมูลติดต่อ</Typography>
              {contactRows.length ? (
                <Stack spacing={2.2} sx={{ mt: 2 }}>
                  {contactRows.map((item) => (
                    <Stack key={item.label} direction="row" spacing={1.4} alignItems="flex-start">
                      {item.icon}
                      <Box>
                        <Typography fontWeight={900}>{item.label}</Typography>
                        <Typography color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
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
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
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
                      startIcon={item.icon}
                      sx={{ justifyContent: "flex-start" }}
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
        </Grid>
      </Grid>
    </PublicSiteShell>
  );
}
