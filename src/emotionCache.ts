import createCache, { type EmotionCache } from "@emotion/cache";

export const APP_EMOTION_CACHE_KEY = "css";

export function createAppEmotionCache(): EmotionCache {
  return createCache({ key: APP_EMOTION_CACHE_KEY });
}
