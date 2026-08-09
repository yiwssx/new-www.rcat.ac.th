import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeHashScroller } from "./PublicHomePage";

function createAnchor({ visible }: { visible: boolean }) {
  const anchor = document.createElement("div");
  anchor.dataset.eServiceAnchor = "true";

  Object.defineProperty(anchor, "getClientRects", {
    configurable: true,
    value: () => (visible ? [anchor.getBoundingClientRect()] : [])
  });

  const scrollIntoView = vi.fn();
  Object.defineProperty(anchor, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView
  });

  return { anchor, scrollIntoView };
}

describe("HomeHashScroller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/#e-service");
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    window.history.replaceState({}, "", "/");
    vi.useRealTimers();
  });

  it("keeps re-anchoring the visible E-Service target while lazy homepage layout settles", () => {
    const hiddenTarget = createAnchor({ visible: false });
    const visibleTarget = createAnchor({ visible: true });
    document.body.append(hiddenTarget.anchor, visibleTarget.anchor);

    render(<HomeHashScroller />);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(hiddenTarget.scrollIntoView).not.toHaveBeenCalled();
    expect(visibleTarget.scrollIntoView).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(visibleTarget.scrollIntoView.mock.calls.length).toBeGreaterThan(1);
    expect(visibleTarget.scrollIntoView).toHaveBeenLastCalledWith({ block: "start" });
  });

  it("stops delayed re-anchoring as soon as the visitor starts scrolling manually", () => {
    const visibleTarget = createAnchor({ visible: true });
    document.body.append(visibleTarget.anchor);

    render(<HomeHashScroller />);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const scrollCountBeforeUserIntent = visibleTarget.scrollIntoView.mock.calls.length;
    window.dispatchEvent(new WheelEvent("wheel"));

    act(() => {
      vi.runAllTimers();
    });

    expect(visibleTarget.scrollIntoView).toHaveBeenCalledTimes(scrollCountBeforeUserIntent);
  });
});
