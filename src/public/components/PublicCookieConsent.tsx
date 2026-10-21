import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import {
  PUBLIC_COOKIE_CONSENT_OPEN_EVENT,
  PUBLIC_COOKIE_CONSENT_STORAGE_KEY,
  openPublicCookiePreferences,
  readPublicCookieConsent,
  savePublicCookieConsent,
  type PublicCookieConsentChoice
} from "../cookies/publicCookieConsent";

export function usePublicCookieConsent() {
  // undefined during SSR and initial client render: no optional tracking can mount.
  const [consent, setConsent] = useState<PublicCookieConsentChoice | null | undefined>(undefined);

  useEffect(() => {
    setConsent(readPublicCookieConsent());
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PUBLIC_COOKIE_CONSENT_STORAGE_KEY && event.key !== null) return;
      const next = readPublicCookieConsent();
      setConsent((current) => {
        if (current?.analytics && !next?.analytics) {
          // Already-loaded third-party SDKs must not survive withdrawal in another tab.
          window.location.reload();
        }
        return next;
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const chooseConsent = (analytics: boolean) => {
    const hadAnalytics = consent?.analytics === true;
    const next = savePublicCookieConsent(analytics);
    setConsent(next);

    if (hadAnalytics && !analytics) {
      // A reload tears down already-mounted Google/Vercel tags; future visits are blocked.
      window.location.reload();
    }
  };

  return { consent, chooseConsent };
}

interface PublicCookieConsentProps {
  consent: PublicCookieConsentChoice | null | undefined;
  onChoose: (analytics: boolean) => void;
}

export default function PublicCookieConsent({ consent, onChoose }: PublicCookieConsentProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const openSettings = () => {
      setAnalyticsEnabled(consent?.analytics ?? false);
      setSettingsOpen(true);
    };
    window.addEventListener(PUBLIC_COOKIE_CONSENT_OPEN_EVENT, openSettings);
    return () => window.removeEventListener(PUBLIC_COOKIE_CONSENT_OPEN_EVENT, openSettings);
  }, [consent]);

  const selectConsent = (analytics: boolean) => {
    setSettingsOpen(false);
    onChoose(analytics);
  };

  return (
    <>
      {consent === null && !settingsOpen && (
        <Box
          component="aside"
          role="region"
          aria-label="แจ้งการใช้คุกกี้"
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (theme) => theme.zIndex.snackbar,
            p: { xs: 1, sm: 2 },
            pointerEvents: "none"
          }}
        >
          <Paper
            elevation={10}
            sx={{
              maxWidth: 1120,
              mx: "auto",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: { xs: 2, sm: 2.5 },
              pointerEvents: "auto"
            }}
          >
            <Stack spacing={1.5}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
                เว็บไซต์นี้ใช้คุกกี้และข้อมูลการใช้งาน
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                คุกกี้ที่จำเป็นช่วยให้เว็บไซต์ทำงานและเข้าสู่ระบบได้อย่างปลอดภัย
                ส่วนสถิติผู้เข้าชมและเครื่องมือวิเคราะห์จาก Google และ Vercel
                จะทำงานเมื่อท่านยินยอมเท่านั้น ท่านเลือกปฏิเสธได้โดยไม่เสียสิทธิในการเข้าชมเว็บไซต์
                {" "}
                <Link href="/cookie-policy" underline="hover">
                  อ่านนโยบายการใช้คุกกี้
                </Link>
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "flex-end" }}>
                <Button variant="outlined" color="inherit" onClick={() => selectConsent(false)}>
                  ปฏิเสธคุกกี้ที่ไม่จำเป็น
                </Button>
                <Button variant="outlined" onClick={openPublicCookiePreferences}>
                  ตั้งค่าคุกกี้
                </Button>
                <Button variant="contained" onClick={() => selectConsent(true)}>
                  ยอมรับคุกกี้วิเคราะห์
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      )}

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        aria-labelledby="rcat-cookie-settings-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="rcat-cookie-settings-title">ตั้งค่าความเป็นส่วนตัวและคุกกี้</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontWeight: 800 }}>คุกกี้ที่จำเป็น — เปิดใช้งานเสมอ</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.8 }}>
                ใช้สำหรับการทำงานพื้นฐาน ความปลอดภัย และการเข้าสู่ระบบ ไม่สามารถปิดได้จากหน้านี้
              </Typography>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={analyticsEnabled}
                    onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                    slotProps={{ input: { "aria-label": "อนุญาตคุกกี้และระบบวิเคราะห์การใช้งาน" } }}
                  />
                }
                label="สถิติและการวิเคราะห์การใช้งาน"
              />
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                ครอบคลุมระบบนับผู้เข้าชมของ RCAT, Google Tag Manager / Analytics และ Vercel Analytics /
                Speed Insights ปิดไว้เป็นค่าเริ่มต้นจนกว่าจะยินยอม
              </Typography>
            </Box>
            <Typography variant="body2">
              <Link href="/privacy-policy">นโยบายความเป็นส่วนตัว</Link>
              {" · "}
              <Link href="/cookie-policy">นโยบายการใช้คุกกี้</Link>
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1, px: 2, py: 1.5 }}>
          <Button color="inherit" onClick={() => selectConsent(false)}>
            ปฏิเสธ
          </Button>
          <Button variant="outlined" onClick={() => selectConsent(analyticsEnabled)}>
            บันทึกการตั้งค่า
          </Button>
          <Button variant="contained" onClick={() => selectConsent(true)}>
            ยอมรับทั้งหมด
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
