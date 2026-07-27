import { lazy, Suspense, type ReactElement } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Navigate, Outlet } from "@tanstack/react-router";
import RecoveryCodeNavigationGuard from "./admin/components/RecoveryCodeNavigationGuard";
import { AuthProvider } from "./context/AuthContext";
import { RecoveryCodeHandoffProvider } from "./context/RecoveryCodeHandoffProvider";
import { useAuth } from "./context/authSessionContext";
import { hasAnyCmsCapability, type CmsCapability } from "./features/cms-auth";
import { RouteFallback } from "./routeComponents";

const CmsShell = lazy(() => import("./admin/layout/CmsShell"));
const ReauthenticationDialog = lazy(() => import("./admin/components/ReauthenticationDialog"));

export function CmsAuthRouteLayout() {
  return (
    <AuthProvider>
      <RecoveryCodeHandoffProvider>
        <RecoveryCodeNavigationGuard />
        <Outlet />
        <Suspense fallback={null}>
          <ReauthenticationDialog />
        </Suspense>
      </RecoveryCodeHandoffProvider>
    </AuthProvider>
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
