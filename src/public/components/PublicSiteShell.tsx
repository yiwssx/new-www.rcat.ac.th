import { MouseEvent, ReactNode, useState } from "react";
import {
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import FacebookRoundedIcon from "@mui/icons-material/FacebookRounded";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import YouTubeIcon from "@mui/icons-material/YouTube";
import PublicMainMenu from "./PublicMainMenu";
import PublicErrorState from "./PublicErrorState";
import FloatingMessengerButton from "./FloatingMessengerButton";
import PublicIntroGate from "./PublicIntroGate";
import { UrgentMarqueeSection } from "./home/UrgentMarqueeSection";
import { projectSettings } from "../../config/projectSettings";
import { normalizeHomepageSettings } from "../../services/homepageSettings";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { DisplaySettings, FooterDirectoryGroup, HomepageSettings, PublicMenuItem, SiteSettings } from "../../types";
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
  preloadedSiteSettings?: SiteSettings;
  preloadedHomepageSettings?: HomepageSettings;
  preloadedDisplaySettings?: DisplaySettings;
  preloadedMenu?: PublicMenuItem[];
  skipShellDataFetch?: boolean;
}

const FOLLOW_LABEL = "ช่องทางติดตาม";
const ANNOUNCEMENTS_LABEL = "ประกาศ";
const STAFF_LOGIN_LABEL = "สำหรับเจ้าหน้าที่";
const BACK_TO_TOP_LABEL = "กลับขึ้นด้านบน";

const fallbackPublicShellSettings: Partial<SiteSettings> = {
  siteName: projectSettings.site.name,
  heroTitle: projectSettings.site.name,
  footerTitle: projectSettings.site.name
};

function getTelephoneHref(phone: string) {
  const normalizedPhone = String(phone || "").replace(/[^\d+#*]/g, "");
  return normalizedPhone ? `tel:${normalizedPhone}` : "#";
}

function easeInOutCubic(progress: number) {
  return progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function getScrollElement() {
  return document.scrollingElement || document.documentElement;
}

function animateScrollToTop(duration = 1400) {
  const scrollElement = getScrollElement();
  const startY = scrollElement.scrollTop || window.scrollY || 0;

  if (startY <= 0) {
    return;
  }

  const startTime = window.performance.now();

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    const nextY = Math.round(startY * (1 - eased));

    scrollElement.scrollTop = nextY;
    document.documentElement.scrollTop = nextY;
    document.body.scrollTop = nextY;

    if (progress < 1 && nextY > 0) {
      window.requestAnimationFrame(step);
      return;
    }

    scrollElement.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  window.requestAnimationFrame(step);
}

function handleBackToTop(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.stopPropagation();

  animateScrollToTop(1400);
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

function TikTokIcon() {
  return (
    <Box
      component="svg"
      aria-hidden="true"
      viewBox="0 0 448 512"
      sx={{ display: "block", width: "1em", height: "1em", fill: "currentColor" }}
    >
      <path d="M448.5 209.9c-44 .1-87-13.6-122.8-39.2l0 178.7c0 33.1-10.1 65.4-29 92.6s-45.6 48-76.6 59.6-64.8 13.5-96.9 5.3-60.9-25.9-82.7-50.8-35.3-56-39-88.9 2.9-66.1 18.6-95.2 40-52.7 69.6-67.7 62.9-20.5 95.7-16l0 89.9c-15-4.7-31.1-4.6-46 .4s-27.9 14.6-37 27.3-14 28.1-13.9 43.9 5.2 31 14.5 43.7 22.4 22.1 37.4 26.9 31.1 4.8 46-.1 28-14.4 37.2-27.1 14.2-28.1 14.2-43.8l0-349.4 88 0c-.1 7.4 .6 14.9 1.9 22.2 3.1 16.3 9.4 31.9 18.7 45.7s21.3 25.6 35.2 34.6c19.9 13.1 43.2 20.1 67 20.1l0 87.4z" />
    </Box>
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

function getEnabledFooterDirectoryGroups(groups: FooterDirectoryGroup[]) {
  return groups
    .map((group) => ({
      ...group,
      links: group.links.filter(
        (link) => link.enabled && link.label && link.href && link.href !== "#" && normalizeSafeHref(link.href) !== "#"
      )
    }))
    .filter((group) => group.title && group.links.length > 0);
}

function FooterDirectory({ groups }: { groups: FooterDirectoryGroup[] }) {
  const enabledGroups = getEnabledFooterDirectoryGroups(groups);

  if (!enabledGroups.length) {
    return null;
  }

  return (
    <Box
      component="section"
      aria-label="ไดเรกทอรีลิงก์ส่วนท้ายเว็บไซต์"
      sx={{
        bgcolor: "primary.light",
        borderTop: "1px solid rgba(31, 90, 44, 0.12)",
        py: { xs: 3, md: 4 }
      }}
    >
      <Container maxWidth="xl">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
            gap: { xs: 2.5, md: 4 }
          }}
        >
          {enabledGroups.map((group) => (
            <Box key={group.title}>
              <Typography
                component="h2"
                sx={{
                  color: "primary.dark",
                  fontSize: { xs: "1rem", md: "1.08rem" },
                  fontWeight: 900,
                  mb: 1.25
                }}
              >
                {group.title}
              </Typography>
              <Stack component="ul" spacing={0.7} sx={{ m: 0, p: 0, listStyle: "none" }}>
                {group.links.map((link) => (
                  <Box component="li" key={link.label}>
                    <Typography
                      component="a"
                      href={normalizeSafeHref(link.href)}
                      aria-label={`เปิดลิงก์ ${link.label}`}
                      sx={{
                        color: "text.secondary",
                        display: "inline-block",
                        fontSize: { xs: "0.9rem", md: "0.94rem" },
                        lineHeight: 1.55,
                        textDecoration: "none",
                        transition: "color 160ms ease",
                        "&:hover": {
                          color: "primary.dark",
                          textDecoration: "underline",
                          textUnderlineOffset: "3px"
                        },
                        "&:focus-visible": {
                          borderRadius: 0.5,
                          outline: "2px solid",
                          outlineColor: "secondary.main",
                          outlineOffset: 3
                        }
                      }}
                    >
                      {link.label}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
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
  disableMainContainer = false,
  preloadedSiteSettings,
  preloadedHomepageSettings,
  preloadedMenu,
  skipShellDataFetch = false
}: PublicSiteShellProps) {
  const navigate = useNavigate();
  const hasPreloadedShellData =
    Boolean(preloadedSiteSettings) && Boolean(preloadedHomepageSettings) && preloadedMenu !== undefined;
  const shouldFetchShellData = !skipShellDataFetch && !hasPreloadedShellData;
  const { data, isLoading, isFetching, isError, refetch } = usePublicCmsSnapshot({
    enabled: shouldFetchShellData
  });
  const [searchQuery, setSearchQuery] = useState("");
  const shellSiteSettings = preloadedSiteSettings ?? data?.siteSettings ?? fallbackPublicShellSettings;
  const shellHomepageSettings = preloadedHomepageSettings ?? data?.homepageSettings;
  const isShellFetching = shouldFetchShellData && !data && (isLoading || isFetching);
  const isInitialPublicError = shouldFetchShellData && !data && isError && !isShellFetching;
  const defaultCanonicalPath = typeof window === "undefined" ? undefined : window.location.pathname;
  const siteSettings = normalizeSiteSettings(shellSiteSettings);
  const homepageSettings = normalizeHomepageSettings(shellHomepageSettings);
  const siteName = siteSettings.siteName;

  useDocumentMetadata({
    title: isInitialPublicError ? "ไม่สามารถโหลดข้อมูลได้" : (seoTitle ?? title ?? siteName),
    description: isInitialPublicError ? "กรุณาลองใหม่อีกครั้ง" : (seoDescription ?? description),
    canonicalUrl,
    canonicalPath: canonicalPath ?? defaultCanonicalPath,
    siteName
  });

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

  const showPageHeader = !hidePageHeader && (Boolean(title) || Boolean(description));
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
      icon: <TikTokIcon />
    });
  }

  return (
    <Box
      id="top"
      sx={{ minHeight: "100vh", bgcolor: "background.default" }}
      className={`rcat-page${siteSettings.mourningModeEnabled ? " rcat-mourning-mode" : ""}`}
      data-mourning-mode={siteSettings.mourningModeEnabled ? "true" : "false"}
    >
      <PublicIntroGate settings={homepageSettings.introGate} />
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
                  decoding="async"
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
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const query = searchQuery.trim();

                  if (!query) {
                    return;
                  }

                  void navigate({ to: "/search", search: { q: query } });
                }}
                sx={{
                  width: { xs: "100%", sm: 210, md: 230, lg: 240 },
                  maxWidth: { xs: "100%", sm: 240 },
                  flex: { xs: "1 1 100%", sm: "0 1 230px", lg: "0 0 240px" }
                }}
              >
                <TextField
                  type="search"
                  size="small"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="ค้นหาในเว็บไซต์"
                  aria-label="ค้นหาในเว็บไซต์"
                  fullWidth
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchOutlinedIcon fontSize="small" />
                        </InputAdornment>
                      )
                    }
                  }}
                  sx={{
                    "& .MuiInputBase-root": {
                      bgcolor: "white",
                      borderRadius: 1,
                      height: { xs: 36, md: 38 }
                    },
                    "& .MuiInputBase-input": {
                      py: { xs: 0.65, md: 0.75 },
                      fontSize: { xs: "0.86rem", md: "0.9rem" }
                    },
                    "& .MuiInputAdornment-root svg": {
                      fontSize: { xs: "1rem", md: "1.08rem" }
                    }
                  }}
                />
              </Box>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <PublicMainMenu preloadedMenu={preloadedMenu ?? data?.menu ?? (skipShellDataFetch ? [] : undefined)} />

      <UrgentMarqueeSection settings={homepageSettings.marquee} />

      {siteSettings.mourningModeEnabled && siteSettings.mourningModeNotice && (
        <Box
          role="status"
          sx={{ bgcolor: "grey.900", color: "common.white", py: 1, px: 2, textAlign: "center", fontWeight: 800 }}
        >
          {siteSettings.mourningModeNotice}
        </Box>
      )}

      {isShellFetching && <LinearProgress sx={{ height: 3 }} />}

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

      <Box
        component="main"
        sx={{
          pt: disableMainContainer ? 0 : { xs: 3, md: 4.5 },
          pb: { xs: 3, md: 4.5 }
        }}
        className="rcat-container"
      >
        {disableMainContainer ? children : <Container maxWidth="xl">{children}</Container>}
      </Box>

      <FooterDirectory groups={siteSettings.footerDirectoryGroups} />

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
                component="button"
                type="button"
                color="inherit"
                onClick={handleBackToTop}
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
      <FloatingMessengerButton
        enabled={siteSettings.messengerEnabled}
        href={siteSettings.messengerUrl}
        label={siteSettings.messengerLabel}
      />
    </Box>
  );
}
