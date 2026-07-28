export interface ContrastPair {
  name: string;
  foreground: string;
  background: string;
  minimumRatio: number;
}

function normalizeHexColor(value: string) {
  const normalized = value.trim().replace(/^#/, "");

  if (/^[\da-f]{3}$/i.test(normalized)) {
    return normalized
      .split("")
      .map((character) => `${character}${character}`)
      .join("");
  }

  if (/^[\da-f]{6}$/i.test(normalized)) {
    return normalized;
  }

  throw new TypeError(`Unsupported color format: ${value}`);
}

export function hexToRgb(value: string) {
  const normalized = normalizeHexColor(value);
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function linearize(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(value: string) {
  const { red, green, blue } = hexToRgb(value);
  return linearize(red) * 0.2126 + linearize(green) * 0.7152 + linearize(blue) * 0.0722;
}

export function getContrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function evaluateContrastPair(pair: ContrastPair) {
  const ratio = getContrastRatio(pair.foreground, pair.background);
  return {
    ...pair,
    ratio,
    passes: ratio >= pair.minimumRatio
  };
}
