import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  Typography
} from "@mui/material";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import FacebookRoundedIcon from "@mui/icons-material/FacebookRounded";
import YouTubeIcon from "@mui/icons-material/YouTube";
import LanguageSwitch from "./LanguageSwitch";
import PublicMainMenu from "./PublicMainMenu";
import { getCmsSiteName, projectSettings } from "../config/projectSettings";
import { Language, useLanguage } from "../context/LanguageContext";
import { defaultPublicLanguageSource } from "../pages/PublicHomePage";
import { loadPublicLanguageSource } from "../services/languageSource";
import { appSwal } from "../utils/swal";

interface PublicSiteShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export default function PublicSiteShell({ title, description, children }: PublicSiteShellProps) {
  const { language, setLanguage } = useLanguage();
  const { data: languageSource = defaultPublicLanguageSource } = useQuery({
    queryKey: ["public-language-source"],
    queryFn: async () => loadPublicLanguageSource(defaultPublicLanguageSource)
  });
  const copy = languageSource[language];

  async function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    await appSwal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: languageSource[nextLanguage].languageToast,
      showConfirmButton: false,
      timer: 1400,
      timerProgressBar: true
    });
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }} className="min-h-screen bg-rcat-soft-bg">
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
            <Typography variant="body2">{copy.campus}</Typography>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography variant="body2" sx={{ opacity: 0.88 }}>
                {copy.portal}
              </Typography>
              <LanguageSwitch
                value={language}
                onChange={(nextLanguage) => void handleLanguageChange(nextLanguage)}
                color="light"
              />
              <IconButton
                component="a"
                href="https://www.facebook.com/"
                color="inherit"
                size="small"
                sx={{ border: "1px solid rgba(255, 255, 255, 0.22)" }}
              >
                <FacebookRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton
                component="a"
                href="https://www.youtube.com/"
                color="inherit"
                size="small"
                sx={{ border: "1px solid rgba(255, 255, 255, 0.22)" }}
              >
                <YouTubeIcon fontSize="small" />
              </IconButton>
            </Stack>
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
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                component="img"
                src={projectSettings.site.logoPath}
                alt={projectSettings.site.logoAlt}
                sx={{ width: 58, height: 58, objectFit: "contain" }}
              />
              <Box>
                <Typography
                  sx={{
                    color: "secondary.dark",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase"
                  }}
                >
                  {copy.eyebrow}
                </Typography>
                <Typography variant="h1" sx={{ fontSize: { xs: "1.55rem", md: "2rem" } }}>
                  {getCmsSiteName() || copy.siteName}
                </Typography>
              </Box>
            </Stack>
            <Button href="/login" variant="outlined" startIcon={<AdminPanelSettingsOutlinedIcon />}>
              {copy.staffLogin}
            </Button>
          </Stack>
        </Container>
      </Box>

      <PublicMainMenu />

      <Box
        sx={(theme) => ({
          bgcolor: "white",
          borderBottom: "1px solid rgba(31, 90, 44, 0.12)",
          background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.background.paper} 62%, ${theme.palette.secondary.light} 100%)`
        })}
      >
        <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
          <Typography variant="h1" sx={{ fontSize: { xs: "2rem", md: "2.8rem" }, maxWidth: 860 }}>
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 820 }}>
            {description}
          </Typography>
        </Container>
      </Box>

      <Box component="main" sx={{ py: { xs: 3, md: 4.5 } }} className="mx-auto w-full max-w-[1680px]">
        <Container maxWidth="xl">{children}</Container>
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
              <Typography fontWeight={900} sx={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {copy.footerTitle}
              </Typography>
              <Typography sx={{ color: "rgba(255, 255, 255, 0.76)", mt: 0.6, maxWidth: 720 }}>
                {copy.footerDescription}
              </Typography>
            </Box>
            <Button color="inherit" href="/">
              {copy.nav[0]}
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
