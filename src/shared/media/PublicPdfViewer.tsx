import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { MediaAsset } from "../../types";
import { focusVisibleSx } from "../../design-system/componentStyles";
import { getPdfOpenUrl, getPdfViewerUrl, isPdfMediaAsset } from "./pdfMedia";
import PublicDeferredEmbed from "./PublicDeferredEmbed";

interface PublicPdfViewerProps {
  asset: MediaAsset;
  caption?: string;
  loadMode?: "eager" | "near-viewport";
}

export default function PublicPdfViewer({ asset, caption = "", loadMode = "near-viewport" }: PublicPdfViewerProps) {
  if (!isPdfMediaAsset(asset)) {
    return null;
  }

  const viewerUrl = getPdfViewerUrl(asset);
  const openUrl = getPdfOpenUrl(asset);
  const canOpen = openUrl !== "#";

  return (
    <Box
      data-public-pdf-viewer="true"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "background.paper"
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          p: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider"
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <DescriptionOutlinedIcon color="primary" />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800 }} noWrap>
              {asset.name}
            </Typography>
            {!!caption && (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {caption}
              </Typography>
            )}
          </Box>
        </Stack>
        <Button
          component={canOpen ? "a" : "button"}
          href={canOpen ? openUrl : undefined}
          target={canOpen ? "_blank" : undefined}
          rel={canOpen ? "noreferrer" : undefined}
          disabled={!canOpen}
          variant="outlined"
          size="small"
          startIcon={<OpenInNewOutlinedIcon />}
          aria-label={asset.name}
          sx={{ flexShrink: 0, ...focusVisibleSx }}
        >
          เปิด PDF ในแท็บใหม่
        </Button>
      </Stack>

      {viewerUrl ? (
        <PublicDeferredEmbed
          title={`PDF: ${asset.name}`}
          src={viewerUrl}
          loadMode={loadMode}
          nearViewportMargin="640px 0px"
          sx={{
            width: "100%",
            height: { xs: 520, sm: 620, md: 760 },
            bgcolor: "background.default"
          }}
        />
      ) : (
        <Box
          sx={{
            minHeight: { xs: 220, md: 280 },
            display: "grid",
            placeItems: "center",
            p: 3,
            bgcolor: "action.hover",
            textAlign: "center"
          }}
        >
          <Stack spacing={1} sx={{ alignItems: "center" }}>
            <DescriptionOutlinedIcon color="primary" sx={{ fontSize: 42 }} />
            <Typography sx={{ fontWeight: 700 }}>ไม่สามารถแสดงตัวอย่าง PDF ในหน้านี้ได้</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้ปุ่มด้านบนเพื่อเปิดเอกสารในแท็บใหม่
            </Typography>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
