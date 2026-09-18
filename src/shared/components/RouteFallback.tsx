import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

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
