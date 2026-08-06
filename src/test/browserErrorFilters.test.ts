import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VITE_PRELOAD_RELOAD_COOLDOWN_MS,
  installBrowserErrorFilters,
  shouldRecoverFromVitePreloadError
} from "../utils/browserErrorFilters";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("browser error filters", () => {
  it("registers a Vite preload-error recovery listener before route loading", () => {
    const addEventListener = vi.spyOn(window, "addEventListener").mockImplementation(() => undefined);

    installBrowserErrorFilters();

    expect(addEventListener).toHaveBeenCalledWith("vite:preloadError", expect.any(Function));
  });

  it("allows one stale-chunk reload and blocks an immediate reload loop", () => {
    const now = 100_000;

    expect(shouldRecoverFromVitePreloadError(0, now)).toBe(true);
    expect(shouldRecoverFromVitePreloadError(now - VITE_PRELOAD_RELOAD_COOLDOWN_MS + 1, now)).toBe(false);
    expect(shouldRecoverFromVitePreloadError(now - VITE_PRELOAD_RELOAD_COOLDOWN_MS, now)).toBe(true);
  });
});
