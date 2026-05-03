import { ReactNode } from "react";
import { Box, Button, Container, IconButton, Stack, Typography } from "@mui/material";
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
import PublicErrorState from "./PublicErrorState";
import PublicLoadingState from "./PublicLoadingState";
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

function getTelephoneHref(phone: string) {
  const normalizedPhone = String(phone || "").replace(/[^\d+#*]/g, "");
  return normalizedPhone ? `tel:${normalizedPhone}` : "#";
}

interface TopBarSocialLink {
  label: string;
  href: string;
  icon: ReactNode;
}

interface TopBarInfoItemProps {
  icon: ReactNode;
  text: string;
  href?: string;
  compact?: boolean;
  allowShrink?: boolean;
}

function TopBarInfoItem({ icon, text, href, compact = false, allowShrink = false }: TopBarInfoItemProps) {
  const content = (
    <>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
          "& svg": {
            fontSize: compact ? { xs: "0.82rem", sm: "0.96rem", md: "1.05rem" } : { md: "1.05rem" }
          },
          "& .svg-inline--fa": {
            fontSize: compact ? { xs: "0.82rem", sm: "0.96rem", md: "1.05rem" } : { md: "1.05rem" }
          }
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="body2"
        sx={{
          minWidth: allowShrink ? 0 : undefined,
          fontSize: compact ? { xs: "0.66rem", sm: "0.78rem", md: "0.875rem" } : { md: "0.875rem" },
          lineHeight: 1.18,
          overflow: allowShrink ? "hidden" : "visible",
          textOverflow: allowShrink ? "ellipsis" : "clip",
          whiteSpace: "nowrap"
        }}
      >
        {text}
      </Typography>
    </>
  );

  const sx = {
    color: "inherit",
    textDecoration: "none",
    minWidth: allowShrink ? 0 : "max-content",
    maxWidth: "100%",
    flex: allowShrink ? "1 1 auto" : "0 0 auto",
    "&:focus-visible": {
      outline: "2px solid",
      outlineColor: "secondary.main",
      outlineOffset: 2,
      borderRadius: 1
    }
  };

  if (href) {
    return (
      <Stack
        component="a"
        href={normalizeSafeHref(href)}
        direction="row"
        spacing={{ xs: 0.45, sm: 0.55, md: 0.75 }}
        alignItems="center"
        sx={sx}
      >
        {content}
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={{ xs: 0.45, sm: 0.55, md: 0.75 }} alignItems="center" sx={sx}>
      {content}
    </Stack>
  );
}

function TopBarSocialIcons({ links, showLabel }: { links: TopBarSocialLink[]; showLabel: boolean }) {
  if (!links.length) {
    return null;
  }

  return (
    <Stack
      direction="row"
      spacing={{ xs: 0.35, sm: 0.45, md: 0.75 }}
      alignItems="center"
      justifyContent="flex-end"
      sx={{ minWidth: "max-content", flexShrink: 0 }}
    >
      {showLabel && (
        <Typography variant="body2" sx={{ opacity: 0.88, whiteSpace: "nowrap" }}>
          {FOLLOW_LABEL}
        </Typography>
      )}

      {links.map((item) => (
        <IconButton
          key={item.label}
          component="a"
          href={normalizeSafeHref(item.href)}
          aria-label={item.label}
          color="inherit"
          size="small"
          sx={{
            width: { xs: 22, sm: 26, md: 34 },
            height: { xs: 22, sm: 26, md: 34 },
            p: { xs: 0.2, sm: 0.3, md: 0.5 },
            border: "1px solid rgba(255, 255, 255, 0.22)",
            bgcolor: "rgba(255, 255, 255, 0.06)",
            "& svg": {
              fontSize: { xs: "0.78rem", sm: "0.92rem", md: "1.25rem" }
            },
            "& .svg-inline--fa": {
              fontSize: { xs: "0.78rem", sm: "0.92rem", md: "1.25rem" }
            },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "secondary.main",
              outlineOffset: 2
            }
          }}
        >
          {item.icon}
        </IconButton>
      ))}
    </Stack>
  );
}

function MobileTopBar({
  campus,
  phone,
  email,
  socialLinks
}: {
  campus: string;
  phone?: string;
  email?: string;
  socialLinks: TopBarSocialLink[];
}) {
  return (
    <Box
      sx={{
        display: { xs: "grid", md: "none" },
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gridTemplateRows: "auto auto",
        columnGap: { xs: 0.75, sm: 1.1 },
        rowGap: { xs: 0.35, sm: 0.45 },
        alignItems: "center",
        py: { xs: 0.45, sm: 0.55 },
        minWidth: 0,
        overflow: "hidden"
      }}
    >
      <Box sx={{ gridColumn: phone ? "1 / 2" : "1 / 3", gridRow: "1 / 2", minWidth: 0 }}>
        <TopBarInfoItem icon={<LocationOnOutlinedIcon />} text={campus} compact allowShrink />
      </Box>

      {phone && (
        <Box sx={{ gridColumn: "2 / 3", gridRow: "1 / 2", justifySelf: "end", minWidth: "max-content" }}>
          <TopBarInfoItem icon={<LocalPhoneOutlinedIcon />} text={phone} href={getTelephoneHref(phone)} compact />
        </Box>
      )}

      {email && (
        <Box sx={{ gridColumn: "1 / 2", gridRow: "2 / 3", minWidth: 0 }}>
          <TopBarInfoItem icon={<MailOutlineRoundedIcon />} text={email} compact allowShrink />
        </Box>
      )}

      {!!socialLinks.length && (
        <Box sx={{ gridColumn: "2 / 3", gridRow: "2 / 3", justifySelf: "end", minWidth: "max-content" }}>
          <TopBarSocialIcons links={socialLinks} showLabel={false} />
        </Box>
      )}
    </Box>
  );
}

function DesktopTopBar({
  campus,
  siteName,
  phone,
  email,
  socialLinks
}: {
  campus?: string;
  siteName: string;
  phone?: string;
  email?: string;
  socialLinks: TopBarSocialLink[];
}) {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      justifyContent="space-between"
      sx={{
        display: { xs: "none", md: "flex" },
        py: { md: 1.1 },
        minWidth: 0,
        overflow: "hidden"
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: "1 1 auto" }}>
        <TopBarInfoItem icon={<LocationOnOutlinedIcon />} text={campus || siteName} allowShrink />

        {phone && <TopBarInfoItem icon={<LocalPhoneOutlinedIcon />} text={phone} href={getTelephoneHref(phone)} />}

        {email && <TopBarInfoItem icon={<MailOutlineRoundedIcon />} text={email} />}
      </Stack>

      <TopBarSocialIcons links={socialLinks} showLabel />
    </Stack>
  );
}

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
  const { data, isLoading, isFetching, isError, refetch } = usePublicCmsSnapshot();
  const isInitialPublicLoading = !data && (isLoading || isFetching);
  const isInitialPublicError = !data && isError && !isInitialPublicLoading;
  const shouldShowPublicLoading = isInitialPublicLoading || (!data && !isError);
  const defaultCanonicalPath = typeof window === "undefined" ? undefined : window.location.pathname;

  useDocumentMetadata({
    title: shouldShowPublicLoading
      ? "กำลังโหลดข้อมูล"
      : isInitialPublicError
        ? "ไม่สามารถโหลดข้อมูลได้"
        : seoTitle ?? title,
    description: shouldShowPublicLoading
      ? "กรุณารอสักครู่ ระบบกำลังดึงข้อมูลเว็บไซต์"
      : isInitialPublicError
        ? "กรุณาลองใหม่อีกครั้ง"
        : seoDescription ?? description,
    canonicalUrl,
    canonicalPath: canonicalPath ?? defaultCanonicalPath,
    siteName: data?.siteSettings?.siteName?.trim() || projectSettings.site.name
  });

  if (shouldShowPublicLoading) {
    return <PublicLoadingState />;
  }

  if (isInitialPublicError) {
    return (
      <PublicErrorState
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isFetching}
      />
    );
  }

  const siteSettings = normalizeSiteSettings(data?.siteSettings);
  const showPageHeader = !hidePageHeader && (Boolean(title) || Boolean(description));
  const siteName = siteSettings.siteName;
  const socialLinks: TopBarSocialLink[] = [];

  if (siteSettings.facebookUrl) {
    socialLinks.push({
      label: "Facebook",
      href: siteSettings.facebookUrl,
      icon: <FacebookRoundedIcon fontSize="small" />
    });
  }

  if (siteSettings.youtubeUrl) {
    socialLinks.push({
      label: "YouTube",
      href: siteSettings.youtubeUrl,
      icon: <YouTubeIcon fontSize="small" />
    });
  }

  if (siteSettings.tiktokUrl) {
    socialLinks.push({
      label: "TikTok",
      href: siteSettings.tiktokUrl,
      icon: <FontAwesomeIcon icon={faTiktok} />
    });
  }

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
          <MobileTopBar
            campus={siteSettings.campus || siteName}
            phone={siteSettings.phone}
            email={siteSettings.email}
            socialLinks={socialLinks}
          />
          <DesktopTopBar
            campus={siteSettings.campus}
            siteName={siteName}
            phone={siteSettings.phone}
            email={siteSettings.email}
            socialLinks={socialLinks}
          />
        </Container>
      </Box>

      <Box sx={{ bgcolor: "white", borderBottom: "1px solid rgba(31, 90, 44, 0.14)" }}>
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={{ xs: 1.2, md: 2 }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", lg: "center" }}
            sx={{ py: { xs: 1.2, md: 2.4 } }}
          >
            <Stack direction="row" spacing={{ xs: 1.1, md: 2 }} alignItems="center" sx={{ width: "100%", minWidth: 0 }}>
              <Box
                sx={{
                  width: { xs: 54, sm: 58, md: 86 },
                  height: { xs: 54, sm: 58, md: 86 },
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
                  sx={{ width: { xs: 42, sm: 46, md: 64 }, height: { xs: 42, sm: 46, md: 64 }, objectFit: "contain" }}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                {siteSettings.eyebrow && (
                  <Typography
                    sx={{
                      color: "secondary.dark",
                      fontSize: { xs: "0.74rem", md: "0.82rem" },
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      lineHeight: 1.25,
                      textTransform: "uppercase",
                      mb: { xs: 0.2, md: 0.4 }
                    }}
                  >
                    {siteSettings.eyebrow}
                  </Typography>
                )}
                <Typography
                  variant="h1"
                  sx={{ fontSize: { xs: "1.34rem", sm: "1.5rem", md: "2.4rem" }, lineHeight: 1.08 }}
                >
                  {siteName}
                </Typography>
                {siteSettings.intro && (
                  <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: { xs: 0.35, md: 0.6 } }}>
                    <EmojiEventsOutlinedIcon sx={{ color: "secondary.dark", fontSize: { xs: 17, md: 24 } }} />
                    <Typography
                      color="text.secondary"
                      sx={{
                        maxWidth: 860,
                        fontSize: { xs: "0.78rem", md: "1rem" },
                        overflow: { xs: "hidden", md: "visible" },
                        display: { xs: "-webkit-box", md: "block" },
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: { xs: 1, md: "unset" }
                      }}
                    >
                      {siteSettings.intro}
                    </Typography>
                  </Stack>
                )}
              </Box>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              sx={{ flexWrap: "wrap", width: { xs: "100%", lg: "auto" } }}
            >
              {siteSettings.admissionUrl && (
                <Button
                  variant="contained"
                  color="error"
                  href={normalizeSafeHref(siteSettings.admissionUrl)}
                  startIcon={<AssignmentIcon />}
                  sx={{ flex: { xs: "1 1 132px", sm: "0 0 auto" } }}
                >
                  สมัครเรียน
                </Button>
              )}
              <Button
                variant="contained"
                color="primary"
                href={normalizeSafeHref("/announcements")}
                endIcon={<ArrowForwardOutlinedIcon />}
                sx={{ flex: { xs: "1 1 132px", sm: "0 0 auto" } }}
              >
                {ANNOUNCEMENTS_LABEL}
              </Button>
              <Button
                variant="text"
                color="primary"
                href={normalizeSafeHref("/login")}
                startIcon={<AdminPanelSettingsOutlinedIcon />}
                sx={{ display: { xs: "none", sm: "inline-flex" } }}
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
              <Button
                color="inherit"
                href={normalizeSafeHref("#top")}
                startIcon={<ArrowForwardOutlinedIcon sx={{ transform: "rotate(-90deg)" }} />}
              >
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
