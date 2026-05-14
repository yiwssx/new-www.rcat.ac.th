import { Box, LinearProgress } from "@mui/material";

export default function PublicLoadingState() {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label="Preparing page"
      sx={{
        width: "100%",
        py: { xs: 1.5, md: 2 }
      }}
    >
      <LinearProgress sx={{ height: 3 }} />
    </Box>
  );
}
