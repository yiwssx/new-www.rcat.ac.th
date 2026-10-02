import createCache, { type EmotionCache } from "@emotion/cache";

export const APP_EMOTION_CACHE_KEY = "css";
export const APP_EMOTION_CSS_LAYER = "mui";

const CSS_LAYER_ORDER_DECLARATION = /^@layer\s+[^{]*$/;

export function wrapEmotionStylesInMuiLayer(styles: string) {
  if (CSS_LAYER_ORDER_DECLARATION.test(styles)) {
    return styles;
  }

  return `@layer ${APP_EMOTION_CSS_LAYER} {${styles}}`;
}

export function createAppEmotionCache(): EmotionCache {
  const cache = createCache({ key: APP_EMOTION_CACHE_KEY });
  const originalInsert = cache.insert;

  cache.insert = (selector, serialized, sheet, shouldCache) =>
    originalInsert(
      selector,
      {
        ...serialized,
        styles: wrapEmotionStylesInMuiLayer(serialized.styles)
      },
      sheet,
      shouldCache
    );

  return cache;
}
