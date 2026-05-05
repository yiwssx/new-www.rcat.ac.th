import { Box, Fab, Tooltip } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFacebookMessenger } from "@fortawesome/free-brands-svg-icons";

const messengerUrl = "https://m.me/100063746585360";

export default function FloatingMessengerButton() {
  return (
    <Tooltip title="แชทกับเจ้าหน้าที่" placement="left">
      <Fab
        component="a"
        href={messengerUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="แชทกับเจ้าหน้าที่ผ่าน Messenger"
        sx={(theme) => ({
          position: "fixed",
          right: { xs: 16, md: 24 },
          bottom: { xs: "calc(16px + env(safe-area-inset-bottom))", md: 24 },
          zIndex: theme.zIndex.tooltip,
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
    </Tooltip>
  );
}
