import Box from "@mui/material/Box";

export default function PublicMourningRibbon() {
  return (
    <Box
      component="svg"
      viewBox="0 0 128 128"
      aria-hidden="true"
      focusable="false"
      data-mourning-ribbon="true"
      sx={(theme) => ({
        position: "fixed",
        top: 0,
        left: 0,
        width: { xs: 80, sm: 96, md: 112, lg: 128 },
        height: { xs: 80, sm: 96, md: 112, lg: 128 },
        zIndex: theme.zIndex.appBar + 1,
        pointerEvents: "none",
        "--mourning-ribbon-fabric": theme.palette.grey[800],
        "--mourning-ribbon-outline": theme.palette.grey[900],
        "--mourning-ribbon-ring": theme.palette.grey[500],
        "--mourning-ribbon-medallion": theme.palette.common.white,
        "--mourning-ribbon-emblem": theme.palette.grey[700]
      })}
    >
      <path d="M68 0H128L0 128V68Z" fill="var(--mourning-ribbon-fabric)" />

      <circle
        cx="46"
        cy="47"
        r="33"
        fill="var(--mourning-ribbon-medallion)"
        stroke="var(--mourning-ribbon-outline)"
        strokeWidth="2"
      />
      <circle
        cx="46"
        cy="47"
        r="29"
        fill="none"
        stroke="var(--mourning-ribbon-ring)"
        strokeWidth="1.75"
      />

      <path
        d="M46 26.5C38.8 31.9 35.1 38.2 35.1 44.7c0 6.2 3.9 11.1 8 15.3L33.7 75.8l8.4 4.7L46.3 68l7.4 12.1 8-5-10.2-15.4c4.5-4.6 8.4-9.5 8.4-15.6 0-6.5-4.3-12.5-13.9-17.6Zm.1 8.6c4.5 3.3 6.8 6.5 6.8 9.6 0 3.2-2.2 6.3-6.6 10.5-3.8-3.9-5.9-7-5.9-10.4 0-3.1 1.9-6.3 5.7-9.7Z"
        fill="var(--mourning-ribbon-emblem)"
        fillRule="evenodd"
      />
    </Box>
  );
}
