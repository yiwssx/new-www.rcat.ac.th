import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { alpha } from "@mui/material/styles";
import { Backdrop, Box, CircularProgress, LinearProgress, Stack, Typography } from "@mui/material";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "../../context/authSessionContext";
import { getGoogleApiActivityCount, subscribeGoogleApiActivity } from "../../shared/api/activity";

const showDelayMs = 120;
const minVisibleMs = 320;

function useGoogleApiActivityCount() {
  return useSyncExternalStore(subscribeGoogleApiActivity, getGoogleApiActivityCount, () => 0);
}

export default function AdminActionProgress() {
  const { session } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeRequestCount = useGoogleApiActivityCount();
  const [open, setOpen] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  const canSeeManagementProgress = session?.user.role === "admin" || session?.user.role === "editor";
  const isAdminArea = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/login";
  const shouldShow = (isLoginPage || (canSeeManagementProgress && isAdminArea)) && activeRequestCount > 0;

  const title = isLoginPage ? "กำลังตรวจสอบบัญชีของคุณ" : "กำลังบันทึกการเปลี่ยนแปลง";
  const description = isLoginPage
    ? "กรุณารอสักครู่ระหว่างตรวจสอบข้อมูลเข้าสู่ระบบ"
    : "กำลังดำเนินการคำขอ กรุณาเปิดหน้านี้ไว้";

  useEffect(() => {
    let timeoutId: number | undefined;

    if (shouldShow) {
      if (open) {
        return undefined;
      }

      timeoutId = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setOpen(true);
      }, showDelayMs);

      return () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    if (!open) {
      shownAtRef.current = null;
      return undefined;
    }

    const visibleForMs = shownAtRef.current ? Date.now() - shownAtRef.current : minVisibleMs;
    const hideDelayMs = Math.max(minVisibleMs - visibleForMs, 0);

    timeoutId = window.setTimeout(() => {
      setOpen(false);
      shownAtRef.current = null;
    }, hideDelayMs);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [open, shouldShow]);

  return (
    <Backdrop
      open={open}
      sx={(theme) => ({
        zIndex: theme.zIndex.modal + 2,
        color: theme.palette.common.white,
        backgroundColor: alpha(theme.palette.common.black, 0.34),
        backdropFilter: "blur(4px)"
      })}
    >
      <Box
        sx={(theme) => ({
          width: "min(92vw, 420px)",
          p: 2.5,
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.common.white, 0.24)}`,
          background: `linear-gradient(180deg, ${alpha(theme.palette.primary.dark, 0.88)} 0%, ${alpha(theme.palette.primary.main, 0.82)} 100%)`,
          boxShadow: "0 20px 42px rgba(0, 0, 0, 0.25)"
        })}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.8 }}>
          <CircularProgress color="inherit" size={36} thickness={4.8} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={900}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: alpha("#ffffff", 0.9) }}>
              {description}
            </Typography>
          </Box>
        </Stack>
        <LinearProgress
          sx={{
            height: 6,
            borderRadius: 999,
            bgcolor: alpha("#ffffff", 0.2),
            "& .MuiLinearProgress-bar": {
              borderRadius: 999
            }
          }}
        />
      </Box>
    </Backdrop>
  );
}
