// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { APP_EMOTION_CACHE_KEY, createAppEmotionCache } from "../emotionCache";

describe("Emotion browser hydration", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("adopts server-rendered Emotion ids when the browser cache is created", () => {
    document.head.innerHTML = `<style data-emotion="${APP_EMOTION_CACHE_KEY} server-seeded">.css-server-seeded{color:red}</style>`;
    const serverStyle = document.head.querySelector(`style[data-emotion="${APP_EMOTION_CACHE_KEY} server-seeded"]`);

    const cache = createAppEmotionCache();

    expect(cache.key).toBe(APP_EMOTION_CACHE_KEY);
    expect(cache.inserted["server-seeded"]).toBe(true);
    expect(serverStyle).not.toBeNull();
    expect(document.head.contains(serverStyle)).toBe(true);
  });
});
