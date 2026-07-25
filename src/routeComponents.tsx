import { Suspense, lazy, type ReactElement } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Navigate, Outlet, useParams } from "@tanstack/react-router";
import { PublicAnalytics } from "./shared/components/PublicAnalytics";
import { PublicSiteViewTracker } from "./features/site-view";
import { VercelInsights } from "./shared/components/VercelInsights";
import { useAuth } from "./context/authSessionContext";
import { hasAnyCmsCapability, type CmsCapability } from "./features/cms-auth";
import RecoveryCodeNavigationGuard from "./admin/components/RecoveryCodeNavigationGuard";

export const AccountSecurityPage = lazy(() => import("./admin/pages/AccountSecurityPage"));
export const ActivateAccountPage = lazy(() => import("./admin/pages/ActivateAccountPage"));
export const CalendarPage = lazy(() => import("./admin/pages/CalendarPage"));
export const BackupPage = lazy(() => import("./admin/pages/BackupPage"));
export const CarouselPage = lazy(() => import("./admin/pages/CarouselPage"));
export const CmsShell = lazy(() => import("./admin/layout/CmsShell"));
export const ContentPage = lazy(() => import("./admin/pages/ContentPage"));
export const DashboardPage = lazy(() => import("./admin/pages/DashboardPage"));
export const DocumentsPage = lazy(() => import("./admin/pages/DocumentsPage"));
export const ExternalServicesPage = lazy(() => import("./admin/pages/ExternalServicesPage"));
export const IntegrationsPage = lazy(() => import("./admin/pages/IntegrationsPage"));
export const LoginPage = lazy(() => import("./admin/pages/LoginPage"));
export const MediaPage = lazy(() => import("./admin/pages/MediaPage"));
export const MenuPage = lazy(() => import("./admin/pages/MenuPage"));
export const NotFoundPage = lazy(() => import("./shared/pages/NotFoundPage"));
export const PublicAchievementsPage = lazy(() => import("./public/pages/PublicAchievementsPage"));
export const PublicAnnouncementsPage = lazy(() => import("./public/pages/PublicAnnouncementsPage"));
export const PublicBlogPage = lazy(() => import("./public/pages/PublicBlogPage"));
export const PublicCalendarPage = lazy(() => import("./public/pages/PublicCalendarPage"));
export const PublicContactPage = lazy(() => import("./public/pages/PublicContactPage"));
export const PublicContentDetailPage = lazy(() => import("./public/pages/PublicContentDetailPage"));
export const PublicDepartmentsPage = lazy(() => import("./public/pages/PublicDepartmentsPage"));
export const PublicDocumentsPage = lazy(() => import("./public/pages/PublicDocumentsPage"));
export const PublicHomePage = lazy(() => import("./public/pages/PublicHomePage"));
export const PublicNewsPage = lazy(() => import("./public/pages/PublicNewsPage"));
export const PublicSearchPage = lazy(() => import("./public/pages/PublicSearchPage"));
export const ResetPasswordPage = lazy(() => import("./admin/pages/ResetPasswordPage"));
export const SettingsPage = lazy(() => import("./admin/pages/SettingsPage"));
export const UsersPage = lazy(() => import("./admin/pages/UsersPage"));

export function RouteFallback() {
  return (
    <Box
      sx={{
        minHeight: "62vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default"
      }}
      className="rcat-section-tight grid min-h-[62vh] place-items-center"
    >
      <CircularProgress />
    </Box>
  );
}

export function RootRouteLayout() {
  return (
    <>
      <RecoveryCodeNavigationGuard />
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
        <PublicAnalytics />
        <PublicSiteViewTracker />
        <VercelInsights />
      </Suspense>
    </>
  );
}

export function ProtectedLayout() {
  const { refreshSession, session, status } = useAuth();

  if (status === "bootstrapping") {
    return <RouteFallback />;
  }

  if (status === "unavailable") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3 }}>
        <Stack spacing={2} sx={{ width: "min(100%, 560px)" }}>
          <Alert severity="warning">ระบบยืนยันตัวตน CMS ไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้ง</Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" onClick={() => void refreshSession().catch(() => undefined)}>
              ลองใหม่
            </Button>
            <Button component="a" href="/" variant="outlined">
              กลับเว็บไซต์หลัก
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }

  if (status === "unauthenticated" || !session) {
    return <Navigate to="/login" replace />;
  }

  return <CmsShell />;
}

export function CapabilityGuard({
  capability,
  anyOf,
  children
}: {
  capability?: CmsCapability;
  anyOf?: readonly CmsCapability[];
  children: ReactElement;
}) {
  const { capabilities, status } = useAuth();

  if (status === "bootstrapping") {
    return <RouteFallback />;
  }

  const required = capability ? [capability] : (anyOf ?? []);

  if (!hasAnyCmsCapability(capabilities, required)) {
    return (
      <Box sx={{ py: 6 }}>
        <Stack spacing={2} sx={{ maxWidth: 640, mx: "auto" }}>
          <Typography variant="h2">ไม่มีสิทธิ์เข้าถึง</Typography>
          <Alert severity="warning">
            บัญชีนี้ไม่มีความสามารถที่จำเป็นสำหรับหน้านี้ การซ่อนหน้านี้เป็นเพียงส่วนติดต่อผู้ใช้
            และเซิร์ฟเวอร์ยังคงตรวจสอบสิทธิ์ทุกคำขอ
          </Alert>
          <Button component="a" href="/admin" variant="contained" sx={{ alignSelf: "flex-start" }}>
            กลับหน้าแดชบอร์ด
          </Button>
        </Stack>
      </Box>
    );
  }

  return children;
}

export function PublicContentDetailRoute() {
  const { slug } = useParams({ strict: false }) as { slug: string };

  return <PublicContentDetailPage slug={slug} />;
}
