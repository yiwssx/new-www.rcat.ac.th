import { Fragment, useState, type ReactNode } from "react";

const countryFlagPattern = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
// Country-flag artwork: Twemoji (jdecked/twemoji), graphics licensed under CC BY 4.0.
const twemojiFlagAssetBase = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/";

function getCountryFlagAssetUrl(flag: string) {
  const codePoints = Array.from(flag, (character) => character.codePointAt(0)?.toString(16)).filter(Boolean);
  return codePoints.length === 2 ? `${twemojiFlagAssetBase}${codePoints.join("-")}.svg` : "";
}

function CountryFlagGlyph({ flag }: { flag: string }) {
  const [failed, setFailed] = useState(false);
  const src = getCountryFlagAssetUrl(flag);

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
      style={{
        width: "1em",
        height: "1em",
        margin: "0 0.075em",
        verticalAlign: "-0.125em",
        objectFit: "contain"
      }}
    />
  );
}

export default function FlagEmojiText({ children }: { children: string }) {
  const matches = Array.from(children.matchAll(countryFlagPattern));

  if (!matches.length) {
    return <>{children}</>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    const index = match.index ?? 0;
    const flag = match[0];

    if (index > cursor) {
      parts.push(<Fragment key={`text-${cursor}`}>{children.slice(cursor, index)}</Fragment>);
    }

    parts.push(<CountryFlagGlyph key={`flag-${index}-${flag}`} flag={flag} />);
    cursor = index + flag.length;
  }

  if (cursor < children.length) {
    parts.push(<Fragment key={`text-${cursor}`}>{children.slice(cursor)}</Fragment>);
  }

  return <>{parts}</>;
}
