if (typeof window !== "undefined") {
  // @dnd-kit/dom observes draggable geometry during module initialization.
  // jsdom has no native layout observer; provide the inert browser API seam
  // before importing components. Real browser/E2E tests use native observers.
  if (typeof globalThis.ResizeObserver === "undefined") {
    class JsdomResizeObserver implements ResizeObserver {
      observe(_target: Element) {}
      unobserve(_target: Element) {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      value: JsdomResizeObserver,
      configurable: true
    });
  }

  await import("@testing-library/jest-dom/vitest");

  if (!window.localStorage || typeof window.localStorage.getItem !== "function") {
    const storage = new Map<string, string>();

    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        }
      },
      configurable: true
    });
  }

  Object.defineProperty(window, "scrollTo", {
    value: () => {},
    configurable: true
  });
}

export {};
