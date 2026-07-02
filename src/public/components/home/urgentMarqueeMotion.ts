export const defaultMarqueePixelsPerSecond = 80;

const minMarqueePixelsPerSecond = 35;
const maxMarqueePixelsPerSecond = 180;
const legacyMarqueeDistancePx = 4800;
const reducedMotionSpeedMultiplier = 0.5;

export interface MarqueeMotion {
  startX: string;
  endX: string;
  durationSeconds: number;
  reducedMotionDurationSeconds: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundMotionValue(value: number) {
  return Number(value.toFixed(3));
}

export function formatMarqueeSeconds(value: number) {
  return roundMotionValue(value).toString();
}

export function getMarqueePixelsPerSecond(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return defaultMarqueePixelsPerSecond;
  }

  return clamp(legacyMarqueeDistancePx / numericValue, minMarqueePixelsPerSecond, maxMarqueePixelsPerSecond);
}

function getReducedMotionPixelsPerSecond(pixelsPerSecond: number) {
  return Math.max(1, pixelsPerSecond * reducedMotionSpeedMultiplier);
}

export function getFallbackMarqueeMotion(pixelsPerSecond: number): MarqueeMotion {
  return {
    startX: "100%",
    endX: "-100%",
    durationSeconds: roundMotionValue(legacyMarqueeDistancePx / pixelsPerSecond),
    reducedMotionDurationSeconds: roundMotionValue(
      legacyMarqueeDistancePx / getReducedMotionPixelsPerSecond(pixelsPerSecond)
    )
  };
}

export function getMarqueeMotion(viewportWidth: number, trackWidth: number, pixelsPerSecond: number): MarqueeMotion {
  if (!Number.isFinite(viewportWidth) || !Number.isFinite(trackWidth) || viewportWidth <= 0 || trackWidth <= 0) {
    return getFallbackMarqueeMotion(pixelsPerSecond);
  }

  const totalDistancePx = viewportWidth + trackWidth;

  return {
    startX: `${roundMotionValue(viewportWidth)}px`,
    endX: `-${roundMotionValue(trackWidth)}px`,
    durationSeconds: roundMotionValue(totalDistancePx / pixelsPerSecond),
    reducedMotionDurationSeconds: roundMotionValue(totalDistancePx / getReducedMotionPixelsPerSecond(pixelsPerSecond))
  };
}
