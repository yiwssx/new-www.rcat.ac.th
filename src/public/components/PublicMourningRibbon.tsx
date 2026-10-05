import Box from "@mui/material/Box";

const MOURNING_RIBBON_ASSET = "/mourning-ribbon.png";

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
      sx={(theme) => ({
        position: "fixed",
        top: 0,
        left: 0,
        display: "block",
        width: { xs: 80, sm: 96, md: 112, lg: 128 },
        height: "auto",
        maxWidth: "none",
        zIndex: theme.zIndex.modal + 10,
        pointerEvents: "none",
        objectFit: "contain",
        objectPosition: "top left"
      })}
    />
  );
}
