import { Fragment } from "react";
import Box from "@mui/material/Box";
import PublicResponsiveImage from "../media/PublicResponsiveImage";
import {
  getCountryFlagCode,
  getFlagEmojiAssetUrl,
  isCountryFlagEmoji,
  splitCountryFlagEmoji
} from "../../utils/flagEmoji";

interface FlagEmojiTextProps {
  text: string;
}

function CountryFlagImage({ flag }: { flag: string }) {
  const src = getFlagEmojiAssetUrl(flag);

  if (!src) {
    return <>{flag}</>;
  }

  return (
    <PublicResponsiveImage
      source={src}
      intent="tiny-thumbnail"
      alt={flag}
      bypassPageMediaGate
      loadMode="eager"
      fill
      rootComponent="span"
      fallback={
        <Box component="span" aria-hidden="true">
          {flag}
        </Box>
      }
      sx={{
        display: "inline-block",
        width: "1.25em",
        height: "0.94em",
        marginInline: "0.08em",
        verticalAlign: "-0.08em",
        overflow: "hidden"
      }}
      imageSx={{ objectFit: "cover" }}
    />
  );
}

export default function FlagEmojiText({ text }: FlagEmojiTextProps) {
  const parts = splitCountryFlagEmoji(text);

  if (parts.length === 1) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) =>
        isCountryFlagEmoji(part) ? (
          <CountryFlagImage key={`${getCountryFlagCode(part)}-${index}`} flag={part} />
        ) : (
          <Fragment key={`text-${index}`}>{part}</Fragment>
        )
      )}
    </>
  );
}
