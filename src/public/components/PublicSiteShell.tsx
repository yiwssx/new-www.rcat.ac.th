import {
  createContext,
  MouseEvent,
  ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState
} from "react";
import {
  Box,
  Button,
  Container,
  InputAdornment,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";

import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";

import PublicMainMenu from "./PublicMainMenu";
import PublicErrorState from "./PublicErrorState";
import PublicFooterDirectory from "./PublicFooterDirectory";
import FloatingMessengerButton from "./FloatingMessengerButton";
import PublicIntroGate from "./PublicIntroGate";
import { getInitialPublicIntroGateVisibility, getPublicIntroGateStorageKey } from "./publicIntroGateState";
import { UrgentMarqueeSection } from "./home/UrgentMarqueeSection";
import SocialIconLink from "./SocialIconLink";
import { PublicMediaLoadingProvider } from "../../shared/media/PublicMediaLoadingContext";
import PublicResponsiveImage from "../../shared/media/PublicResponsiveImage";
import { projectSettings } from "../../config/projectSettings";
import { normalizeHomepageSettings } from "../../services/homepageSettings";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { DisplaySettings, HomepageSettings, PublicMenuItem, SiteSettings } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { focusVisibleSx } from "../../design-system/componentStyles";
import type { SocialPlatform } from "../../design-system/icons/SocialBrandIcon";
import { useDocumentMetadata } from "../../utils/seo";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

export interface PublicSiteShellProps {
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
  routeLayout?: boolean;
  routePathname?: string;
}

type PublicSiteShellRegistrationProps = Omit<PublicSiteShellProps, "children">;

interface PublicSiteShellRegistration {
  pathname: string;
  props: PublicSiteShellRegistrationProps;
  token: symbol;
}

interface PublicSiteShellRegistrationController {
  activeRegistration: PublicSiteShellRegistration | null;
  register: (registration: PublicSiteShellRegistration) => void;
  unregister: (token: symbol) => void;
}

const PublicSiteShellRegistrationContext = createContext<PublicSiteShellRegistrationController | null>(null);

const FOLLOW_LABEL = "ช่องทางติดตาม";
const ANNOUNCEMENTS_LABEL = "ประกาศ";
const STAFF_LOGIN_LABEL = "สำหรับเจ้าหน้าที่";
const BACK_TO_TOP_LABEL = "กลับขึ้นด้านบน";

const fallbackPublicShellSettings: Partial<SiteSettings> = {
  siteName: projectSettings.site.name,
  heroTitle: projectSettings.site.name,
  footerTitle: projectSettings.site.name
};

interface PublicRouteShellDefaults {
  title?: string;
  description?: string;
  hidePageHeader?: boolean;
  disableMainContainer?: boolean;
  pageHeaderLoading?: boolean;
  skipShellDataFetch?: boolean;
}

function getPublicRouteShellDefaults(pathname: string): PublicRouteShellDefaults {
  const routeDefaults: Record<string, PublicRouteShellDefaults> = {
    "/": {
      hidePageHeader: true,
      disableMainContainer: true,
      skipShellDataFetch: true
    },
    "/news": {
      title: "ข่าว",
      description: "กิจกรรมล่าสุด เรื่องราวในสถานศึกษา และข่าวประชาสัมพันธ์จาก CMS"
    },
    "/announcements": {
      title: "ประกาศ",
      description: "ประกาศราชการ ข้อมูลการรับสมัคร และเอกสารสาธารณะที่เผยแพร่โดยสถานศึกษา"
    },
    "/achievements": {
      title: "ผลงานและความภาคภูมิใจ",
      description: "รวมผลงาน รางวัล และความสำเร็จของสถานศึกษา"
    },
    "/blog": {
      title: "บทความ",
      description: "บทความและเนื้อหาระยะยาวที่เผยแพร่จาก CMS"
    },
    "/departments": {
      title: "หลักสูตร",
      description: "ข้อมูลหลักสูตรที่เผยแพร่จาก CMS"
    },
    "/documents": {
      title: "เอกสารเผยแพร่",
      description: "เอกสารและไฟล์เผยแพร่สำหรับประชาชน"
    },
    "/calendar": {
      title: "กำหนดการ",
      description: "กำหนดการและกิจกรรมที่เผยแพร่ของสถานศึกษา"
    },
    "/contact": {
      title: "ติดต่อ",
      description: "ข้อมูลติดต่อที่เผยแพร่จาก CMS"
    },
    "/search": {
      title: "ค้นหา",
      description: "ผลการค้นหาในเว็บไซต์"
    }
  };

  return (
    routeDefaults[pathname] ?? {
      pageHeaderLoading: true
    }
  );
}

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
  platform: SocialPlatform;
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
    ...focusVisibleSx
  };

  if (href) {
    return (
      <Stack
        component="a"
        href={normalizeSafeHref(href)}
        direction="row"
        spacing={{ xs: 0.45, sm: 0.55, md: 0.75 }}
        sx={[
          {
            alignItems: "center"
          },
          ...(Array.isArray(sx) ? sx : [sx])
        ]}
      >
        {content}
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={{ xs: 0.45, sm: 0.55, md: 0.75 }}
      sx={[
        {
          alignItems: "center"
        },
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
    >
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
      sx={{
        alignItems: "center",
        justifyContent: "flex-end",
        minWidth: "max-content",
        flexShrink: 0
      }}
    >
      {showLabel && (
        <Typography variant="body2" sx={{ opacity: 0.88, whiteSpace: "nowrap" }}>
          {FOLLOW_LABEL}
        </Typography>
      )}
      {links.map((item) => (
        <SocialIconLink key={item.label} platform={item.platform} href={item.href} label={item.label} />
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
        minHeight: { xs: 50, sm: 54 },
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
      sx={{
        alignItems: "center",
        justifyContent: "space-between",
        display: { xs: "none", md: "flex" },
        py: { md: 1.1 },
        minWidth: 0,
        overflow: "hidden"
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{
          alignItems: "center",
          minWidth: 0,
          flex: "1 1 auto"
        }}
      >
        <TopBarInfoItem icon={<LocationOnOutlinedIcon />} text={campus || siteName} allowShrink />

        {phone && <TopBarInfoItem icon={<LocalPhoneOutlinedIcon />} text={phone} href={getTelephoneHref(phone)} />}

        {email && <TopBarInfoItem icon={<MailOutlineRoundedIcon />} text={email} />}
      </Stack>
      <TopBarSocialIcons links={socialLinks} showLabel />
    </Stack>
  );
}

function RegisteredPublicSiteShell({
  children,
  ...registrationProps
}: PublicSiteShellProps & {
  children: ReactNode;
}) {
  const controller = useContext(PublicSiteShellRegistrationContext);
  const register = controller?.register;
  const unregister = controller?.unregister;
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [token] = useState(() => Symbol("public-site-shell-registration"));
  const stableRegistrationProps = useMemo<PublicSiteShellRegistrationProps>(
    () => ({
      canonicalPath: registrationProps.canonicalPath,
      canonicalUrl: registrationProps.canonicalUrl,
      description: registrationProps.description,
      disableMainContainer: registrationProps.disableMainContainer,
      hidePageHeader: registrationProps.hidePageHeader,
      preloadedDisplaySettings: registrationProps.preloadedDisplaySettings,
      preloadedHomepageSettings: registrationProps.preloadedHomepageSettings,
      preloadedMenu: registrationProps.preloadedMenu,
      preloadedSiteSettings: registrationProps.preloadedSiteSettings,
      routeLayout: registrationProps.routeLayout,
      seoDescription: registrationProps.seoDescription,
      seoTitle: registrationProps.seoTitle,
      skipShellDataFetch: registrationProps.skipShellDataFetch,
      title: registrationProps.title
    }),
    [
      registrationProps.canonicalPath,
      registrationProps.canonicalUrl,
      registrationProps.description,
      registrationProps.disableMainContainer,
      registrationProps.hidePageHeader,
      registrationProps.preloadedDisplaySettings,
      registrationProps.preloadedHomepageSettings,
      registrationProps.preloadedMenu,
      registrationProps.preloadedSiteSettings,
      registrationProps.routeLayout,
      registrationProps.seoDescription,
      registrationProps.seoTitle,
      registrationProps.skipShellDataFetch,
      registrationProps.title
    ]
  );
  const registration = useMemo<PublicSiteShellRegistration>(
    () => ({
      pathname,
      props: stableRegistrationProps,
      token
    }),
    [pathname, stableRegistrationProps, token]
  );

  useLayoutEffect(() => {
    register?.(registration);

    return () => {
      unregister?.(token);
    };
  }, [register, registration, token, unregister]);

  return controller?.activeRegistration === registration ? <>{children}</> : null;
}

function PublicSiteShellFrame({
  title: frameTitle,
  description: frameDescription,
  seoTitle: frameSeoTitle,
  seoDescription: frameSeoDescription,
  canonicalUrl: frameCanonicalUrl,
  canonicalPath: frameCanonicalPath,
  children,
  hidePageHeader: frameHidePageHeader,
  disableMainContainer: frameDisableMainContainer,
  preloadedSiteSettings: framePreloadedSiteSettings,
  preloadedHomepageSettings: framePreloadedHomepageSettings,
  preloadedMenu: framePreloadedMenu,
  skipShellDataFetch: frameSkipShellDataFetch,
  routeLayout = false,
  routePathname
}: PublicSiteShellProps) {
  const navigate = useNavigate();
  const pathname = routePathname ?? (typeof window === "undefined" ? "/" : window.location.pathname);
  const [registeredPage, setRegisteredPage] = useState<PublicSiteShellRegistration | null>(null);
  const register = useCallback((registration: PublicSiteShellRegistration) => {
    setRegisteredPage(registration);
  }, []);
  const unregister = useCallback((token: symbol) => {
    setRegisteredPage((current) => (current?.token === token ? null : current));
  }, []);
  const registrationController = useMemo(
    () => ({
      activeRegistration: registeredPage,
      register,
      unregister
    }),
    [register, registeredPage, unregister]
  );
  const activePageProps = registeredPage && registeredPage.pathname === pathname ? registeredPage.props : undefined;
  const routeDefaults = routeLayout ? getPublicRouteShellDefaults(pathname || "/") : {};
  const title = activePageProps?.title ?? frameTitle ?? routeDefaults.title;
  const description = activePageProps?.description ?? frameDescription ?? routeDefaults.description;
  const seoTitle = activePageProps?.seoTitle ?? frameSeoTitle;
  const seoDescription = activePageProps?.seoDescription ?? frameSeoDescription;
  const canonicalUrl = activePageProps?.canonicalUrl ?? frameCanonicalUrl;
  const canonicalPath = activePageProps?.canonicalPath ?? frameCanonicalPath;
  const hidePageHeader =
    activePageProps?.hidePageHeader ?? frameHidePageHeader ?? routeDefaults.hidePageHeader ?? false;
  const disableMainContainer =
    activePageProps?.disableMainContainer ?? frameDisableMainContainer ?? routeDefaults.disableMainContainer ?? false;
  const preloadedSiteSettings = activePageProps?.preloadedSiteSettings ?? framePreloadedSiteSettings;
  const preloadedHomepageSettings = activePageProps?.preloadedHomepageSettings ?? framePreloadedHomepageSettings;
  const preloadedMenu = activePageProps?.preloadedMenu ?? framePreloadedMenu;
  const skipShellDataFetch =
    activePageProps?.skipShellDataFetch ?? frameSkipShellDataFetch ?? routeDefaults.skipShellDataFetch ?? false;
  const hasPreloadedShellData =
    Boolean(preloadedSiteSettings) && Boolean(preloadedHomepageSettings) && preloadedMenu !== undefined;
  const shouldFetchShellData = !skipShellDataFetch && !hasPreloadedShellData;
  const { data, isLoading, isFetching, isError, refetch } = usePublicCmsSnapshot({
    enabled: shouldFetchShellData
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [dismissedIntroGateKeys, setDismissedIntroGateKeys] = useState<ReadonlySet<string>>(() => new Set());
  const shellSiteSettings = preloadedSiteSettings ?? data?.siteSettings ?? fallbackPublicShellSettings;
  const shellHomepageSettings = preloadedHomepageSettings ?? data?.homepageSettings;
  const hasResolvedShellSettings = Boolean(preloadedSiteSettings ?? data?.siteSettings);
  const isShellFetching = shouldFetchShellData && !data && (isLoading || isFetching);
  const isInitialPublicError = shouldFetchShellData && !data && isError && !isShellFetching;
  const defaultCanonicalPath = typeof window === "undefined" ? undefined : window.location.pathname;
  const siteSettings = normalizeSiteSettings(shellSiteSettings);
  const homepageSettings = normalizeHomepageSettings(shellHomepageSettings);
  const siteName = siteSettings.siteName;
  const introGateStorageKey = getPublicIntroGateStorageKey(homepageSettings.introGate);
  const introGateVisible =
    getInitialPublicIntroGateVisibility(homepageSettings.introGate) && !dismissedIntroGateKeys.has(introGateStorageKey);

  useDocumentMetadata({
    title: isInitialPublicError ? "ไม่สามารถโหลดข้อมูลได้" : (seoTitle ?? title ?? siteName),
    description: isInitialPublicError ? "กรุณาลองใหม่อีกครั้ง" : (seoDescription ?? description),
    canonicalUrl,
    canonicalPath: canonicalPath ?? defaultCanonicalPath,
    siteName
  });

  const pageHeaderLoading = Boolean(routeDefaults.pageHeaderLoading && !title && !description);
  const showPageHeader = pageHeaderLoading || (!hidePageHeader && (Boolean(title) || Boolean(description)));
  const renderedChildren = isInitialPublicError ? (
    <PublicErrorState
      onRetry={() => {
        void refetch();
      }}
      isRetrying={isFetching}
    />
  ) : (
    children
  );
  const socialLinks: TopBarSocialLink[] = [];

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
    <PublicSiteShellRegistrationContext.Provider value={registrationController}>
      <PublicMediaLoadingProvider pageMediaAllowed={!introGateVisible}>
        <Box
          id="top"
          sx={{ minHeight: "100vh", bgcolor: "background.default" }}
          className={`rcat-page${siteSettings.mourningModeEnabled ? " rcat-mourning-mode" : ""}`}
          data-mourning-mode={siteSettings.mourningModeEnabled ? "true" : "false"}
          data-cls-region="public-shell"
        >
          <PublicIntroGate
            settings={homepageSettings.introGate}
            visible={introGateVisible}
            onDismiss={() => {
              setDismissedIntroGateKeys((current) => new Set(current).add(introGateStorageKey));
            }}
          />
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

          <Box sx={{ bgcolor: "white", borderBottom: "1px solid", borderColor: "divider" }}>
            <Container maxWidth="xl">
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={{ xs: 1.2, md: 2 }}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", lg: "center" },
                  py: { xs: 1.2, md: 2.4 }
                }}
              >
                <Stack
                  direction="row"
                  spacing={{ xs: 1.1, md: 2 }}
                  sx={{
                    alignItems: "center",
                    width: "100%",
                    minWidth: 0
                  }}
                >
                  <PublicResponsiveImage
                    source={projectSettings.site.logoPath}
                    intent="logo"
                    alt={siteName}
                    loadMode="eager"
                    width={128}
                    height={128}
                    fill
                    sx={{
                      width: { xs: 64, sm: 72, md: 88 },
                      height: { xs: 64, sm: 72, md: 88 },
                      flexShrink: 0
                    }}
                    imageSx={{ objectFit: "contain" }}
                  />
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
                      component="h2"
                      variant="h2"
                      sx={{ fontSize: { xs: "1.34rem", sm: "1.5rem", md: "2.4rem" }, lineHeight: 1.08 }}
                    >
                      {siteName}
                    </Typography>
                    {siteSettings.intro && (
                      <Stack
                        direction="row"
                        spacing={0.8}
                        sx={{
                          alignItems: "center",
                          mt: { xs: 0.35, md: 0.6 }
                        }}
                      >
                        <EmojiEventsOutlinedIcon sx={{ color: "secondary.dark", fontSize: { xs: 17, md: 24 } }} />
                        <Typography
                          sx={{
                            color: "text.secondary",
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
                  useFlexGap
                  sx={{
                    alignItems: "center",
                    flexWrap: "wrap",
                    width: { xs: "100%", lg: "auto" }
                  }}
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
                          bgcolor: "white"
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

          <PublicMainMenu preloadedMenu={preloadedMenu ?? data?.menu ?? []} />

          <UrgentMarqueeSection settings={homepageSettings.marquee} />

          {siteSettings.mourningModeEnabled && siteSettings.mourningModeNotice && (
            <Box
              role="status"
              sx={{ bgcolor: "grey.900", color: "common.white", py: 1, px: 2, textAlign: "center", fontWeight: 800 }}
            >
              {siteSettings.mourningModeNotice}
            </Box>
          )}

          <Box sx={{ height: 3 }} data-cls-region="shell-progress">
            {isShellFetching && <LinearProgress aria-label="กำลังโหลดข้อมูลโครงเว็บไซต์" sx={{ height: "100%" }} />}
          </Box>

          {showPageHeader && (
            <Box
              sx={(theme) => ({
                bgcolor: "white",
                borderBottom: "1px solid",
                borderColor: "divider",
                background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.background.paper} 62%, ${theme.palette.secondary.light} 100%)`
              })}
            >
              <Container
                maxWidth="xl"
                sx={{
                  py: { xs: 3, md: 4 },
                  minHeight: pageHeaderLoading ? { xs: 134, md: 148 } : undefined
                }}
              >
                {pageHeaderLoading ? (
                  <Stack aria-hidden="true" spacing={1}>
                    <Skeleton animation={false} variant="rounded" width="42%" height={46} />
                    <Skeleton animation={false} variant="rounded" width="62%" height={24} />
                  </Stack>
                ) : null}
                {!pageHeaderLoading && title && (
                  <Typography variant="h1" sx={{ fontSize: { xs: "2rem", md: "2.8rem" }, maxWidth: 860 }}>
                    {title}
                  </Typography>
                )}
                {!pageHeaderLoading && description && (
                  <Typography
                    sx={{
                      color: "text.secondary",
                      mt: title ? 1 : 0,
                      maxWidth: 820
                    }}
                  >
                    {description}
                  </Typography>
                )}
              </Container>
            </Box>
          )}

          <Box
            component="main"
            data-cls-region="main"
            sx={{
              pt: disableMainContainer ? 0 : { xs: 3, md: 4.5 },
              pb: { xs: 3, md: 4.5 }
            }}
            className="rcat-container"
          >
            {disableMainContainer ? renderedChildren : <Container maxWidth="xl">{renderedChildren}</Container>}
          </Box>

          <PublicFooterDirectory groups={siteSettings.footerDirectoryGroups} pending={!hasResolvedShellSettings} />

          <Box
            component="footer"
            data-cls-region="dark-footer"
            sx={{
              py: 4,
              bgcolor: "primary.dark",
              color: "white",
              mt: 2,
              minHeight: { xs: 215, md: 117 }
            }}
          >
            <Container maxWidth="xl">
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", md: "center" }
                }}
              >
                <Box>
                  {siteSettings.footerTitle && (
                    <Typography
                      sx={{
                        fontWeight: 900,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase"
                      }}
                    >
                      {siteSettings.footerTitle}
                    </Typography>
                  )}
                  {siteSettings.footerDescription && (
                    <Typography
                      sx={(theme) => ({ color: alpha(theme.palette.common.white, 0.82), mt: 0.6, maxWidth: 720 })}
                    >
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
                  <Button
                    color="inherit"
                    href={normalizeSafeHref("/login")}
                    startIcon={<AdminPanelSettingsOutlinedIcon />}
                  >
                    {STAFF_LOGIN_LABEL}
                  </Button>
                </Stack>
              </Stack>
            </Container>
          </Box>
          <FloatingMessengerButton
            enabled={siteSettings.messengerEnabled && !introGateVisible}
            href={siteSettings.messengerUrl}
            label={siteSettings.messengerLabel}
          />
        </Box>
      </PublicMediaLoadingProvider>
    </PublicSiteShellRegistrationContext.Provider>
  );
}

export default function PublicSiteShell(props: PublicSiteShellProps) {
  const registrationController = useContext(PublicSiteShellRegistrationContext);

  if (registrationController) {
    return <RegisteredPublicSiteShell {...props} />;
  }

  return <PublicSiteShellFrame {...props} />;
}
