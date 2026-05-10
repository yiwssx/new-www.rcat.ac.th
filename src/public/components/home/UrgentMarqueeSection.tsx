import { Box, Chip, Container, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import type { HomepageMarqueeSettings } from "../../../types";

export function UrgentMarqueeSection({ settings }: { settings?: HomepageMarqueeSettings }) {
  if (!settings?.enabled || !settings.text.trim()) {
    return null;
  }

  const marqueeText = settings.text.trim();

  return (
    <Box component="section" aria-label="ประกาศด่วน" sx={{ py: { xs: 1, md: 1.2 }, bgcolor: "background.default" }}>
      <Container maxWidth="xl">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 0.8, sm: 1.4 }}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={(theme) => ({
            overflow: "hidden",
            borderRadius: 1.5,
            border: "1px solid rgba(197, 133, 0, 0.26)",
            bgcolor: alpha(theme.palette.secondary.light, 0.36),
            boxShadow: "0 8px 22px rgba(31, 90, 44, 0.08)",
            px: { xs: 1.2, sm: 1.5, md: 2 },
            py: { xs: 0.85, md: 0.95 },
            "@keyframes marqueeScroll": {
              "0%": { transform: "translateX(100%)" },
              "100%": { transform: "translateX(-100%)" }
            },
            "&:hover .marqueeText": {
              animationPlayState: "paused"
            }
          })}
        >
          <Chip
            icon={<CampaignOutlinedIcon />}
            label={settings.label}
            color="secondary"
            sx={{
              alignSelf: { xs: "flex-start", sm: "center" },
              flexShrink: 0,
              color: "secondary.contrastText",
              fontWeight: 900,
              "& .MuiChip-icon": {
                color: "secondary.contrastText"
              }
            }}
          />
          <Box sx={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
            <Typography
              className="marqueeText"
              component="p"
              sx={{
                display: "inline-block",
                whiteSpace: "nowrap",
                color: "primary.dark",
                fontWeight: 900,
                fontSize: { xs: "0.88rem", md: "0.98rem" },
                animation: `marqueeScroll ${settings.speedSeconds}s linear infinite`
              }}
            >
              {marqueeText} &nbsp; • &nbsp; {marqueeText} &nbsp; • &nbsp; {marqueeText}
            </Typography>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
