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
      <defs>
        <linearGradient id="rcat-mourning-ribbon-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#242424" />
          <stop offset="0.48" stopColor="#101010" />
          <stop offset="1" stopColor="#282828" />
        </linearGradient>
      </defs>
      <path d="M0 0h36L120 84v36h-36L0 36Z" fill="url(#rcat-mourning-ribbon-fill)" />
      <path d="M36 0 52 16 35 16 20 0Z" fill="#050505" opacity="0.92" />
      <path d="M0 36 16 52 16 35 0 20Z" fill="#050505" opacity="0.92" />
      <path d="M5 29 91 115" stroke="#353535" strokeWidth="1.5" opacity="0.55" />
    </Box>
  );
}
