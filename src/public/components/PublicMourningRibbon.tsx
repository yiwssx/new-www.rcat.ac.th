import Box from "@mui/material/Box";

const MOURNING_RIBBON_ASSET = "/mourning-ribbon.png";

export default function PublicMourningRibbon() {
  return (
    <Box
      aria-hidden="true"
      data-mourning-ribbon="true"
      sx={(theme) => ({
        position: "fixed",
        top: 0,
        left: 0,
        width: { xs: 80, sm: 96, md: 112, lg: 128 },
        height: { xs: 80, sm: 96, md: 112, lg: 128 },
        zIndex: theme.zIndex.appBar + 1,
        pointerEvents: "none",
        backgroundImage: `url("${MOURNING_RIBBON_ASSET}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "top left",
        backgroundSize: "contain"
      })}
    />
  );
}
