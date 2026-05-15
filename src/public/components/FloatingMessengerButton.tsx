import { Box, Fab, Tooltip } from "@mui/material";
import { normalizeSafeHref } from "../../utils/safeUrl";

interface FloatingMessengerButtonProps {
  href?: string;
  label?: string;
  enabled?: boolean;
}

function MessengerIcon() {
  return (
    <Box
      component="svg"
      aria-hidden="true"
      viewBox="0 0 512 512"
      sx={{ display: "block", width: "1em", height: "1em", fill: "currentColor" }}
    >
      <path d="M256.6 8c-140 0-248.6 102.3-248.6 240.6 0 72.3 29.7 134.8 78.1 177.9 8.3 7.5 6.6 11.9 8 58.2 .1 3.2 1 6.4 2.6 9.2s3.9 5.2 6.7 6.9 5.9 2.8 9.1 3 6.5-.3 9.5-1.6c52.9-23.2 53.6-25 62.6-22.6 153.2 42.2 319.4-55.9 319.4-231C504 110.3 396.6 8 256.6 8zM405.8 193.1l-73 115.6c-2.8 4.3-6.4 8.1-10.6 11s-9.1 4.8-14.1 5.8-10.3 .8-15.3-.4-9.7-3.4-13.8-6.4l-58.1-43.5c-2.6-1.9-5.8-3-9-3s-6.4 1.1-9 3l-78.4 59.4c-10.5 7.9-24.2-4.6-17.1-15.7l73-115.6c2.8-4.3 6.4-8.1 10.6-11s9.1-4.8 14.1-5.8 10.3-.8 15.3 .4 9.7 3.4 13.9 6.4l58.1 43.5c2.6 1.9 5.8 3 9 3s6.4-1.1 9-3l78.4-59.4c10.4-8 24.1 4.5 17.1 15.6z" />
    </Box>
  );
}

export default function FloatingMessengerButton({
  href,
  label = "แชทกับเจ้าหน้าที่",
  enabled = false
}: FloatingMessengerButtonProps) {
  const normalizedHref = normalizeSafeHref(href || "");

  if (!enabled || !href) {
    return null;
  }

  return (
    <Tooltip title={label} placement="left">
      <Box
        sx={(theme) => ({
          position: "fixed",
          right: { xs: 16, md: 24 },
          bottom: {
            xs: "calc(16px + env(safe-area-inset-bottom))",
            md: 96,
            lg: 104
          },
          zIndex: theme.zIndex.tooltip,
          display: "flex",
          alignItems: "center",
          gap: 1
        })}
      >
        <Box
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 36,
            px: 1.4,
            borderRadius: 999,
            bgcolor: "background.paper",
            color: "text.primary",
            fontSize: { xs: "0.78rem", sm: "0.84rem", md: "0.82rem" },
            fontWeight: 800,
            whiteSpace: "nowrap",
            boxShadow: "0 10px 24px rgba(31, 90, 44, 0.16)",
            border: "1px solid rgba(31, 90, 44, 0.12)"
          }}
        >
          {label}
        </Box>

        <Fab
          component="a"
          href={normalizedHref}
          target="_blank"
          rel="noreferrer"
          aria-label={`${label}ผ่าน Messenger`}
          sx={(_theme) => ({
            bgcolor: "#0084ff",
            color: "white",
            boxShadow: "0 12px 28px rgba(0, 132, 255, 0.32)",
            "&:hover": {
              bgcolor: "#006fd6"
            },
            "&:focus-visible": {
              outline: "3px solid",
              outlineColor: "secondary.main",
              outlineOffset: 3
            }
          })}
        >
          <Box component="span" sx={{ display: "inline-flex", fontSize: 26, lineHeight: 1 }}>
            <MessengerIcon />
          </Box>
        </Fab>
      </Box>
    </Tooltip>
  );
}
