import { Fragment, useState } from "react";

const countryFlagEmojiPattern = /([\u{1F1E6}-\u{1F1FF}]{2})/gu;
const countryFlagEmojiOnlyPattern = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;
const twemojiAssetBaseUrl = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg";

interface FlagEmojiTextProps {
  text: string;
}

function getCountryCode(flag: string) {
  if (!countryFlagEmojiOnlyPattern.test(flag)) {
    return "";
  }

  return Array.from(flag)
    .map((character) => String.fromCharCode((character.codePointAt(0) || 0) - 0x1f1e6 + 65))
    .join("")
    .toLowerCase();
}

export function getFlagEmojiAssetUrl(flag: string) {
  if (!getCountryCode(flag)) {
    return "";
  }

  const codePoints = Array.from(flag).map((character) => character.codePointAt(0)?.toString(16));
  return `${twemojiAssetBaseUrl}/${codePoints.join("-")}.svg`;
}

function CountryFlagImage({ flag }: { flag: string }) {
  const [failed, setFailed] = useState(false);
  const src = getFlagEmojiAssetUrl(flag);

  if (!src || failed) {
    return <>{flag}</>;
  }

  return (
    <img
      src={src}
      alt={flag}
      draggable={false}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      data-country-flag={getCountryCode(flag)}
      style={{
        display: "inline-block",
        width: "1.25em",
        height: "0.94em",
        marginInline: "0.08em",
        objectFit: "cover",
        verticalAlign: "-0.08em"
      }}
    />
  );
}

export default function FlagEmojiText({ text }: FlagEmojiTextProps) {
  if (!countryFlagEmojiPattern.test(text)) {
    countryFlagEmojiPattern.lastIndex = 0;
    return <>{text}</>;
  }

  countryFlagEmojiPattern.lastIndex = 0;
  const parts = text.split(countryFlagEmojiPattern);

  return (
    <>
      {parts.map((part, index) =>
        countryFlagEmojiOnlyPattern.test(part) ? (
          <CountryFlagImage key={`${part}-${index}`} flag={part} />
        ) : (
          <Fragment key={`text-${index}`}>{part}</Fragment>
        )
      )}
    </>
  );
}
