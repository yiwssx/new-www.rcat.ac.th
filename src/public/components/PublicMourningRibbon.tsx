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
        color: "grey.900"
      })}
    >
      <defs>
        <linearGradient id="rcat-mourning-ribbon-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.82" />
          <stop offset="0.48" stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.86" />
        </linearGradient>
      </defs>
      <path d="M0 0h36L120 84v36h-36L0 36Z" fill="url(#rcat-mourning-ribbon-fill)" />
      <path d="M36 0 52 16 35 16 20 0Z" fill="currentColor" opacity="0.96" />
      <path d="M0 36 16 52 16 35 0 20Z" fill="currentColor" opacity="0.96" />
      <path d="M5 29 91 115" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </Box>
  );
}
