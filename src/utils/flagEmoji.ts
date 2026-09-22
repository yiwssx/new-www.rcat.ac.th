const countryFlagEmojiOnlyPattern = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;
const twemojiAssetBaseUrl = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg";

export function isCountryFlagEmoji(value: string) {
  return countryFlagEmojiOnlyPattern.test(value);
}

export function splitCountryFlagEmoji(text: string) {
  return text.split(/([\u{1F1E6}-\u{1F1FF}]{2})/gu);
}

export function getCountryFlagCode(flag: string) {
  if (!isCountryFlagEmoji(flag)) {
    return "";
  }

  return Array.from(flag)
    .map((character) => String.fromCharCode((character.codePointAt(0) || 0) - 0x1f1e6 + 65))
    .join("")
    .toLowerCase();
}

export function getFlagEmojiAssetUrl(flag: string) {
  if (!getCountryFlagCode(flag)) {
    return "";
  }

  const codePoints = Array.from(flag).map((character) => character.codePointAt(0)?.toString(16));
  return `${twemojiAssetBaseUrl}/${codePoints.join("-")}.svg`;
}
