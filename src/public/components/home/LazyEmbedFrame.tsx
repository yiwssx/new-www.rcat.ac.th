import type { HTMLAttributeReferrerPolicy } from "react";
import type { SxProps } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import PublicDeferredEmbed from "../../../shared/media/PublicDeferredEmbed";

interface LazyEmbedFrameProps {
  allow?: string;
  allowFullScreen?: boolean;
  referrerPolicy?: HTMLAttributeReferrerPolicy;
  src: string;
  sx?: SxProps<Theme>;
  title: string;
}

export function LazyEmbedFrame({ allow, allowFullScreen, referrerPolicy, src, sx, title }: LazyEmbedFrameProps) {
  return (
    <PublicDeferredEmbed
      src={src}
      title={title}
      allow={allow}
      allowFullScreen={allowFullScreen}
      referrerPolicy={referrerPolicy}
      sx={sx}
    />
  );
}
