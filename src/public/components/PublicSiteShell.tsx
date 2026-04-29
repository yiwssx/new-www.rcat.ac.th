import { ReactNode } from "react";
import {
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  Typography
} from "@mui/material";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import FacebookRoundedIcon from "@mui/icons-material/FacebookRounded";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import YouTubeIcon from "@mui/icons-material/YouTube";
import PublicMainMenu from "./PublicMainMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTiktok } from "@fortawesome/free-brands-svg-icons";
import { projectSettings } from "../../config/projectSettings";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { useDocumentMetadata } from "../../utils/seo";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

interface PublicSiteShellProps {
  title?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  canonicalPath?: string;
  children: ReactNode;
  hidePageHeader?: boolean;
  disableMainContainer?: boolean;
}

const FOLLOW_LABEL = "ช่องทางติดตาม";
const ANNOUNCEMENTS_LABEL = "ประกาศ";
const STAFF_LOGIN_LABEL = "สำหรับเจ้าหน้าที่";
const BACK_TO_TOP_LABEL = "กลับขึ้นด้านบน";

export default function PublicSiteShell({
  title,
  description,
  seoTitle,
  seoDescription,
  canonicalUrl,
  canonicalPath,
  children,
  hidePageHeader = false,
  disableMainContainer = false
}: PublicSiteShellProps) {
  const { data } = usePublicCmsSnapshot();
  const siteSettings = normalizeSiteSettings(data?.siteSettings);
  const showPageHeader = !hidePageHeader && (Boolean(title) || Boolean(description));
  const siteName = siteSettings.siteName;
  const defaultCanonicalPath = typeof window === "undefined" ? undefined : window.location.pathname;
  const socialLinks = [
    {
      label: "Facebook",
      href: siteSettings.facebookUrl,
      icon: <FacebookRoundedIcon fontSize="small" />
    },
    {
      label: "YouTube",
      href: siteSettings.youtubeUrl,
      icon: <YouTubeIcon fontSize="small" />
    },
    {
      label: "TikTok",
      href: siteSettings.tiktokUrl,
      icon: <FontAwesomeIcon icon={faTiktok} style={{ fontSize: "1.25rem" }} />
    }
  ].filter((item) => item.href);

  useDocumentMetadata({
    title: seoTitle ?? title,
    description: seoDescription ?? description,
    canonicalUrl,
    canonicalPath: canonicalPath ?? defaultCanonicalPath,
    siteName
  });

  return (
    <Box id="top" sx={{ minHeight: "100vh", bgcolor: "background.default" }} className="min-h-screen bg-rcat-soft-bg">
      <Box
        sx={{
          bgcolor: "primary.dark",
          color: "white",
          borderBottom: "3px solid",
          borderColor: "secondary.main"
        }}
      >
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            sx={{ py: 1.1 }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.75, sm: 2 }}>
              {siteSettings.campus && (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <LocationOnOutlinedIcon sx={{ fontSize: 18 }} />
                  <Typography variant="body2">{siteSettings.campus}</Typography>
                </Stack>
              )}
              {siteSettings.phone && (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <LocalPhoneOutlinedIcon sx={{ fontSize: 18 }} />
                  <Typography variant="body2">{siteSettings.phone}</Typography>
                </Stack>
              )}
              {siteSettings.email && (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <MailOutlineRoundedIcon sx={{ fontSize: 18 }} />
                  <Typography variant="body2">{siteSettings.email}</Typography>
                </Stack>
              )}
            </Stack>
            {!!socialLinks.length && (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography variant="body2" sx={{ opacity: 0.88 }}>
                  {FOLLOW_LABEL}
                </Typography>
                {socialLinks.map((item) => (
                  <IconButton
                    key={item.label}
                    component="a"
                    href={normalizeSafeHref(item.href)}
                    aria-label={item.label}
                    color="inherit"
                    size="small"
                    sx={{ border: "1px solid rgba(255, 255, 255, 0.22)", bgcolor: "rgba(255, 255, 255, 0.06)" }}
                  >
                    {item.icon}
                  </IconButton>
                ))}
              </Stack>
            )}
          </Stack>
        </Container>
      </Box>

      <Box sx={{ bgcolor: "white", borderBottom: "1px solid rgba(31, 90, 44, 0.14)" }}>
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", lg: "center" }}
            sx={{ py: 2.4 }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: { xs: 72, md: 86 },
                  height: { xs: 72, md: 86 },
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.light",
                  border: "1px solid rgba(31, 90, 44, 0.14)"
                }}
              >
                <Box
                  component="img"
                  src={projectSettings.site.logoPath}
                  alt={siteName}
                  sx={{ width: { xs: 54, md: 64 }, height: { xs: 54, md: 64 }, objectFit: "contain" }}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                {siteSettings.eyebrow && (
                  <Typography
                    sx={{
                      color: "secondary.dark",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      mb: 0.4
                    }}
                  >
                    {siteSettings.eyebrow}
                  </Typography>
                )}
                <Typography variant="h1" sx={{ fontSize: { xs: "1.7rem", md: "2.4rem" }, lineHeight: 1.08 }}>
                  {siteName}
                </Typography>
                {siteSettings.intro && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                    <EmojiEventsOutlinedIcon sx={{ color: "secondary.dark" }} />
                    <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
                      {siteSettings.intro}
                    </Typography>
                  </Stack>
                )}
              </Box>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ xs: "stretch", sm: "center" }}>
              {siteSettings.admissionUrl && (
                <Button
                  variant="contained"
                  color="error"
                  href={normalizeSafeHref(siteSettings.admissionUrl)}
                  startIcon={<AssignmentIcon />}
                >
                  สมัครเรียน
                </Button>
              )}
              <Button
                variant="contained"
                color="primary"
                href={normalizeSafeHref("/announcements")}
                endIcon={<ArrowForwardOutlinedIcon />}
              >
                {ANNOUNCEMENTS_LABEL}
              </Button>
              <Button
                variant="outlined"
                color="primary"
                href={normalizeSafeHref("/login")}
                startIcon={<AdminPanelSettingsOutlinedIcon />}
                sx={{ bgcolor: "white" }}
              >
                {STAFF_LOGIN_LABEL}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <PublicMainMenu />

      {showPageHeader && (
        <Box
          sx={(theme) => ({
            bgcolor: "white",
            borderBottom: "1px solid rgba(31, 90, 44, 0.12)",
            background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.background.paper} 62%, ${theme.palette.secondary.light} 100%)`
          })}
        >
          <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
            {title && (
              <Typography variant="h1" sx={{ fontSize: { xs: "2rem", md: "2.8rem" }, maxWidth: 860 }}>
                {title}
              </Typography>
            )}
            {description && (
              <Typography color="text.secondary" sx={{ mt: title ? 1 : 0, maxWidth: 820 }}>
                {description}
              </Typography>
            )}
          </Container>
        </Box>
      )}

      <Box component="main" sx={{ py: { xs: 3, md: 4.5 } }} className="mx-auto w-full max-w-[1680px]">
        {disableMainContainer ? children : <Container maxWidth="xl">{children}</Container>}
      </Box>

      <Box component="footer" sx={{ py: 4, bgcolor: "primary.dark", color: "white", mt: 2 }}>
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              {siteSettings.footerTitle && (
                <Typography fontWeight={900} sx={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {siteSettings.footerTitle}
                </Typography>
              )}
              {siteSettings.footerDescription && (
                <Typography sx={{ color: "rgba(255, 255, 255, 0.76)", mt: 0.6, maxWidth: 720 }}>
                  {siteSettings.footerDescription}
                </Typography>
              )}
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
              <Button color="inherit" href={normalizeSafeHref("#top")} startIcon={<ArrowForwardOutlinedIcon sx={{ transform: "rotate(-90deg)" }} />}>
                {BACK_TO_TOP_LABEL}
              </Button>
              <Button color="inherit" href={normalizeSafeHref("/login")} startIcon={<AdminPanelSettingsOutlinedIcon />}>
                {STAFF_LOGIN_LABEL}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
