import Box from "@mui/material/Box";

const MOURNING_RIBBON_ASSET = "/mourning-ribbon.svg";

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
      decoding="sync"
      fetchPriority="high"
      sx={(theme) => ({
        position: "fixed",
        top: 0,
        left: 0,
        width: { xs: 80, sm: 96, md: 112, lg: 128 },
        height: { xs: 80, sm: 96, md: 112, lg: 128 },
        zIndex: theme.zIndex.appBar + 1,
        pointerEvents: "none",
        objectFit: "contain",
        objectPosition: "top left"
      })}
    />
  );
}
