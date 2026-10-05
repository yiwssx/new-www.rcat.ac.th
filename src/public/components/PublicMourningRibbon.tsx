import Box from "@mui/material/Box";

export default function PublicMourningRibbon() {
  return (
    <Box
      component="svg"
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
      data-mourning-ribbon="true"
      sx={(theme) => ({
        position: "fixed",
        top: 0,
        left: 0,
        width: { xs: 52, sm: 64, md: 84, lg: 96 },
        height: { xs: 52, sm: 64, md: 84, lg: 96 },
        zIndex: theme.zIndex.appBar + 1,
        pointerEvents: "none",
        filter: "drop-shadow(0 3px 5px rgba(0, 0, 0, 0.28))"
      })}
    >
      <path
        d="M42 8c20 0 35 13 35 30 0 11-6 20-16 29L49 53c7-6 11-11 11-16 0-8-7-14-18-14-10 0-18 6-18 14 0 7 6 14 15 22L29 74C15 63 7 51 7 38 7 21 22 8 42 8Z"
        fill="#111111"
      />
      <path d="M35 55 18 112h20l15-43-10-13-8-1Z" fill="#090909" />
      <path d="m56 55 38 57H73L45 72l11-17Z" fill="#171717" />
      <path d="m38 56 11 15 13-15-8-10-16 10Z" fill="#2b2b2b" />
    </Box>
  );
}
