import IconButton from "@mui/material/IconButton";
import type { SxProps, Theme } from "@mui/material/styles";
import { focusVisibleSx } from "../../design-system/componentStyles";
import SocialBrandIcon, {
  SOCIAL_BRAND_ICON_SIZE,
  type SocialPlatform
} from "../../design-system/icons/SocialBrandIcon";
import { normalizeSafeHref } from "../../utils/safeUrl";

export const SOCIAL_ICON_LINK_SIZE = 40;

export interface SocialIconLinkProps {
  platform: SocialPlatform;
  href: string;
  label: string;
  sx?: SxProps<Theme>;
}

export default function SocialIconLink({ platform, href, label, sx }: SocialIconLinkProps) {
  const sxItems = Array.isArray(sx) ? sx : sx ? [sx] : [];

  return (
    <IconButton
      component="a"
      href={normalizeSafeHref(href)}
      aria-label={label}
      color="inherit"
      size="small"
      disableRipple
      disableFocusRipple
      data-social-icon-link={platform}
      data-social-icon-decoration="none"
      data-social-icon-control="mui-icon-button"
      sx={[
        {
          width: SOCIAL_ICON_LINK_SIZE,
          height: SOCIAL_ICON_LINK_SIZE,
          minWidth: SOCIAL_ICON_LINK_SIZE,
          minHeight: SOCIAL_ICON_LINK_SIZE,
          p: 0,
          flex: `0 0 ${SOCIAL_ICON_LINK_SIZE}px`,
          color: "inherit",
          textDecoration: "none",
          lineHeight: 0,
          border: 0,
          borderRadius: 1,
          bgcolor: "transparent",
          transition: "opacity 120ms ease",
          "&:hover": {
            bgcolor: "transparent",
            opacity: 0.78
          },
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none"
          },
          ...focusVisibleSx
        },
        ...sxItems
      ]}
    >
      <SocialBrandIcon platform={platform} size={SOCIAL_BRAND_ICON_SIZE} />
    </IconButton>
  );
}
