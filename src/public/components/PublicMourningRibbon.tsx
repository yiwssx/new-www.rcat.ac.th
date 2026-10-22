import Box from "@mui/material/Box";
import { MOURNING_RIBBON_SIZE } from "./mourningRibbonLayout";

const MOURNING_RIBBON_ASSET = "/mourning-ribbon.svg?rev=4e0add4";
const MOURNING_RIBBON_Z_INDEX = 9999;

export default function PublicMourningRibbon() {
  return (
    <Box
      data-mourning-ribbon-anchor="true"
      sx={{
        position: "sticky",
        top: 0,
        height: 0,
        zIndex: MOURNING_RIBBON_Z_INDEX,
        pointerEvents: "none"
      }}
    >
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
          position: "absolute",
          top: 0,
          left: 0,
          display: "block",
          width: MOURNING_RIBBON_SIZE,
          height: "auto",
          maxWidth: "none",
          pointerEvents: "none",
          objectFit: "contain",
          objectPosition: "top left"
        }}
      />
    </Box>
  );
}
