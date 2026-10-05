import Box from "@mui/material/Box";

const MOURNING_RIBBON_ASSET = "/mourning-ribbon.png";
const MOURNING_RIBBON_Z_INDEX = 9999;

export default function PublicMourningRibbon() {
  return (
    <Box
      component="img"
      src={MOURNING_RIBBON_ASSET}
      alt=""
      aria-hidden="true"
      data-mourning-ribbon="true"
      width={128}
      height={128}
      loading="eager"
      decoding="sync"
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        display: "block",
        width: { xs: 80, sm: 96, md: 112, lg: 128 },
        height: "auto",
        maxWidth: "none",
        zIndex: MOURNING_RIBBON_Z_INDEX,
        pointerEvents: "none",
        objectFit: "contain",
        objectPosition: "top left"
      }}
    />
  );
}
