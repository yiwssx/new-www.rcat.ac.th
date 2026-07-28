interface ObserverRegistryEntry {
  callbacks: Map<Element, Set<() => void>>;
  observer: IntersectionObserver;
}

const observerRegistry = new Map<string, ObserverRegistryEntry>();

function canObserveNearViewport() {
  return (
    typeof window !== "undefined" &&
    typeof window.IntersectionObserver === "function" &&
    window.IntersectionObserver.name !== "NoopIntersectionObserver"
  );
}

export function observeNearViewport(element: Element, callback: () => void, rootMargin: string) {
  if (!canObserveNearViewport()) {
    callback();
    return () => undefined;
  }

  let registryEntry = observerRegistry.get(rootMargin);

  if (!registryEntry) {
    const callbacks = new Map<Element, Set<() => void>>();
    const observer = new window.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting && entry.intersectionRatio <= 0) {
            continue;
          }

          const elementCallbacks = callbacks.get(entry.target);

          if (!elementCallbacks) {
            continue;
          }

          callbacks.delete(entry.target);
          observer.unobserve(entry.target);

          for (const activate of elementCallbacks) {
            activate();
          }

          if (callbacks.size === 0) {
            observer.disconnect();
            observerRegistry.delete(rootMargin);
          }
        }
      },
      {
        rootMargin
      }
    );

    registryEntry = {
      callbacks,
      observer
    };
    observerRegistry.set(rootMargin, registryEntry);
  }

  const elementCallbacks = registryEntry.callbacks.get(element) ?? new Set<() => void>();
  elementCallbacks.add(callback);
  registryEntry.callbacks.set(element, elementCallbacks);
  registryEntry.observer.observe(element);

  return () => {
    const currentEntry = observerRegistry.get(rootMargin);
    const currentCallbacks = currentEntry?.callbacks.get(element);

    if (!currentEntry || !currentCallbacks) {
      return;
    }

    currentCallbacks.delete(callback);

    if (currentCallbacks.size === 0) {
      currentEntry.callbacks.delete(element);
      currentEntry.observer.unobserve(element);
    }

    if (currentEntry.callbacks.size === 0) {
      currentEntry.observer.disconnect();
      observerRegistry.delete(rootMargin);
    }
  };
}

export function resetNearViewportObserversForTests() {
  for (const entry of observerRegistry.values()) {
    entry.observer.disconnect();
  }

  observerRegistry.clear();
}
