import { FormEvent, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  LinearProgress,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { getCmsSiteName, projectSettings } from "../config/projectSettings";
import { useAuth } from "../context/AuthContext";
import { appSwal } from "../utils/swal";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState(projectSettings.auth.loginPrefill.email);
  const [password, setPassword] = useState(projectSettings.auth.loginPrefill.password);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login(email, password);
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "เข้าสู่ระบบสำเร็จ",
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true
      });
      await navigate({ to: "/admin", replace: true });
    } catch (currentError) {
      const nextError = currentError instanceof Error ? currentError.message : "ไม่สามารถเข้าสู่ระบบได้";
      setError(nextError);
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถเข้าสู่ระบบได้",
        text: nextError,
        confirmButtonText: "ตกลง"
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      className="min-h-screen grid place-items-center px-4 py-8 bg-[radial-gradient(circle_at_top,_rgba(184,135,0,0.18),_transparent_42%),linear-gradient(135deg,_rgba(232,245,233,1)_0%,_rgba(248,251,242,1)_58%,_rgba(255,244,194,0.72)_100%)]"
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.primary.light} 44%, ${theme.palette.secondary.light} 100%)`,
        px: 2,
        py: 5
      }}
    >
      <Container maxWidth="sm">
        <Card className="cms-elevated-surface">
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    color: "primary.main",
                    backgroundColor: "primary.light"
                  }}
                >
                  <SchoolOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="h1" sx={{ fontSize: "1.75rem" }}>
                    {getCmsSiteName()}
                  </Typography>
                  <Typography color="text.secondary">
                    {"ระบบจัดการเนื้อหา"}
                  </Typography>
                </Box>
              </Stack>
              {error && <Alert severity="error">{error}</Alert>}
              <Stack component="form" spacing={2.25} onSubmit={handleSubmit}>
                <TextField
                  label="อีเมล"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                  required
                  fullWidth
                />
                <TextField
                  label="รหัสผ่าน"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting}
                  startIcon={<LoginOutlinedIcon />}
                >
                  {submitting ? "กำลังเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
                </Button>
                {submitting && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: "primary.light",
                      border: "1px solid rgba(31, 90, 44, 0.16)"
                    }}
                  >
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                      {"กำลังตรวจสอบบัญชีของคุณ..."}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
                      {"กรุณารอสักครู่ระหว่างดำเนินการเข้าสู่ระบบ"}
                    </Typography>
                    <LinearProgress sx={{ height: 6, borderRadius: 99 }} />
                  </Box>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
