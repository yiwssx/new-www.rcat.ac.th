import { Box, CircularProgress } from "@mui/material";

export function RouteFallback() {
  return (
    <Box
      sx={{
        minHeight: "62vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default"
      }}
      className="rcat-section-tight grid min-h-[62vh] place-items-center"
    >
      <CircularProgress />
    </Box>
  );
}
