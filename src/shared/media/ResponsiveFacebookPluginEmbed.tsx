import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { buildFacebookPostPluginUrl, clampFacebookPostPluginWidth } from "../../utils/facebookEmbed";
import PublicDeferredEmbed from "./PublicDeferredEmbed";

const DEFAULT_AVAILABLE_WIDTH = 320;
const MINIMUM_FACEBOOK_PLUGIN_WIDTH = 350;

interface ResponsiveFacebookPluginEmbedProps {
  href: string;
  title: string;
  preferredWidth?: number;
  height?: number;
  showText?: boolean;
  borderRadius?: number | string;
}

export default function ResponsiveFacebookPluginEmbed({
  href,
  title,
  preferredWidth = 500,
  height = 820,
  showText = true,
  borderRadius = 1
}: ResponsiveFacebookPluginEmbedProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const requestedWidth = clampFacebookPostPluginWidth(preferredWidth);

  useEffect(() => {
    const measure = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) {
        return;
      }

      const measuredWidth = wrapper.getBoundingClientRect().width || Math.min(DEFAULT_AVAILABLE_WIDTH, requestedWidth);
      setAvailableWidth(Math.max(1, Math.min(requestedWidth, Math.round(measuredWidth))));
    };

    measure();

    const wrapper = wrapperRef.current;
    if (wrapper && typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(wrapper);

      return () => {
        resizeObserver.disconnect();
      };
    }

    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [requestedWidth]);

  const measuredWidth = availableWidth || Math.min(DEFAULT_AVAILABLE_WIDTH, requestedWidth);
  const renderWidth = Math.max(MINIMUM_FACEBOOK_PLUGIN_WIDTH, Math.min(requestedWidth, measuredWidth));
  const visualScale = Math.min(1, measuredWidth / renderWidth);
  const visualHeight = Math.max(1, Math.round(height * visualScale));
  const pluginUrl = buildFacebookPostPluginUrl({
    href,
    showText,
    width: renderWidth
  });

  if (!pluginUrl) {
    return null;
  }

  return (
    <Box
      ref={wrapperRef}
      data-facebook-plugin-embed="true"
      data-facebook-plugin-render-width={String(renderWidth)}
      data-facebook-plugin-visual-scale={visualScale.toFixed(3)}
      sx={{
        width: "100%",
        maxWidth: requestedWidth,
        height: visualHeight,
        mx: "auto",
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start"
      }}
    >
      <Box
        data-facebook-plugin-frame-host="true"
        sx={{
          width: renderWidth,
          height,
          flex: `0 0 ${renderWidth}px`,
          transform: visualScale < 1 ? `scale(${visualScale})` : "none",
          transformOrigin: "top center"
        }}
      >
        <PublicDeferredEmbed
          title={title}
          src={pluginUrl}
          loadMode="eager"
          bypassPageMediaGate
          scrolling="no"
          frameBorder="0"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          width={renderWidth}
          height={height}
          sx={{
            width: renderWidth,
            height,
            borderRadius
          }}
        />
      </Box>
    </Box>
  );
}
