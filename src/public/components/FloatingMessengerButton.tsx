import { Box, Fab, Tooltip } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFacebookMessenger } from "@fortawesome/free-brands-svg-icons";
import { normalizeSafeHref } from "../../utils/safeUrl";

interface FloatingMessengerButtonProps {
  href?: string;
  label?: string;
  enabled?: boolean;
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
            <FontAwesomeIcon icon={faFacebookMessenger} />
          </Box>
        </Fab>
      </Box>
    </Tooltip>
  );
}
