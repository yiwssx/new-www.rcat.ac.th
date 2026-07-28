import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicDeferredEmbed from "./PublicDeferredEmbed";
import { PublicMediaLoadingProvider } from "./PublicMediaLoadingContext";
import PublicResponsiveImage from "./PublicResponsiveImage";
import { resetNearViewportObserversForTests } from "./nearViewport";

class TestIntersectionObserver implements IntersectionObserver {
  static instances: TestIntersectionObserver[] = [];

  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds = [0];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn(() => []);

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    this.rootMargin = options?.rootMargin || "0px";
    TestIntersectionObserver.instances.push(this);
  }

  trigger(target: Element) {
    this.callback(
      [
        {
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRatio: 1,
          intersectionRect: target.getBoundingClientRect(),
          isIntersecting: true,
          rootBounds: null,
          target,
          time: 0
        }
      ],
      this
    );
  }
}

const originalIntersectionObserver = window.IntersectionObserver;

beforeEach(() => {
  TestIntersectionObserver.instances = [];
  resetNearViewportObserversForTests();
  window.IntersectionObserver = TestIntersectionObserver;
});

afterEach(() => {
  resetNearViewportObserversForTests();
  window.IntersectionObserver = originalIntersectionObserver;
  vi.restoreAllMocks();
});

describe("PublicResponsiveImage", () => {
  it("assigns eager/high ownership only in critical mode", () => {
    render(
      <PublicResponsiveImage
        source="https://images.example.edu/critical.jpg"
        intent="content-featured"
        alt="Critical image"
        loadMode="critical"
        width={1200}
        height={800}
      />
    );

    const image = screen.getByRole("img", { name: "Critical image" });
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveAttribute("width", "1200");
    expect(image).toHaveAttribute("height", "800");
  });

  it("fills a parent with explicit geometry and gives the rendered image the same intended dimensions", () => {
    const { container } = render(
      <div data-testid="fixed-parent" style={{ width: 70, height: 70 }}>
        <PublicResponsiveImage
          source="https://images.example.edu/fill.jpg"
          intent="content-card"
          alt="Fill image"
          loadMode="eager"
          fill
        />
      </div>
    );

    const parent = screen.getByTestId("fixed-parent");
    const slot = container.querySelector('[data-public-responsive-image="true"]') as HTMLElement;
    const image = screen.getByRole("img", { name: "Fill image" });

    expect(parent).toHaveStyle({ width: "70px", height: "70px" });
    expect(slot).toHaveAttribute("data-public-image-fill", "true");
    expect(slot).toHaveStyle({ width: "100%", height: "100%" });
    expect(image).toHaveStyle({
      position: "absolute",
      width: "100%",
      height: "100%"
    });
  });

  it("preserves explicit aspect ratio and reserved minimum-height geometry", () => {
    const { container, rerender } = render(
      <PublicResponsiveImage
        source="https://images.example.edu/aspect.jpg"
        intent="event-attachment"
        alt="Aspect image"
        loadMode="eager"
        aspectRatio="4 / 3"
        fill
      />
    );

    let slot = container.querySelector('[data-public-responsive-image="true"]') as HTMLElement;
    expect(slot).toHaveAttribute("data-public-image-aspect-ratio", "4 / 3");
    expect(slot).toHaveStyle({ height: "100%" });

    rerender(
      <PublicResponsiveImage
        source="https://images.example.edu/reserved.jpg"
        intent="content-body"
        alt="Reserved image"
        loadMode="eager"
        reservedMinHeight={180}
      />
    );

    slot = container.querySelector('[data-public-responsive-image="true"]') as HTMLElement;
    expect(slot).toHaveStyle({ minHeight: "180px" });
  });

  it("allows caller sx to override default fill dimensions", () => {
    const { container } = render(
      <PublicResponsiveImage
        source="https://images.example.edu/override.jpg"
        intent="logo"
        alt="Override image"
        loadMode="eager"
        fill
        sx={{ width: 88, height: 44 }}
      />
    );

    const slot = container.querySelector('[data-public-responsive-image="true"]') as HTMLElement;
    expect(slot).toHaveStyle({ width: "88px", height: "44px" });
  });

  it("keeps network-bearing attributes absent until the slot nears the viewport", async () => {
    const { container } = render(
      <PublicResponsiveImage
        source="https://images.example.edu/deferred.jpg"
        intent="content-body"
        alt="Deferred image"
        reservedMinHeight={180}
      />
    );

    const slot = container.querySelector('[data-public-responsive-image="true"]') as Element;
    expect(screen.queryByRole("img", { name: "Deferred image" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-public-image-placeholder="true"]')).toBeInTheDocument();
    expect(slot).toHaveStyle({ minHeight: "180px" });

    act(() => {
      TestIntersectionObserver.instances[0].trigger(slot);
    });

    const image = await screen.findByRole("img", { name: "Deferred image" });
    expect(image).toHaveAttribute("src", "https://images.example.edu/deferred.jpg");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("fetchpriority", "low");
    expect(slot).toHaveStyle({ minHeight: "180px" });
  });

  it("loads safely when IntersectionObserver is unavailable", async () => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: undefined
    });

    render(
      <PublicResponsiveImage
        source="https://images.example.edu/fallback-observer.jpg"
        intent="content-body"
        alt="Observer fallback"
      />
    );

    expect(await screen.findByRole("img", { name: "Observer fallback" })).toHaveAttribute(
      "src",
      "https://images.example.edu/fallback-observer.jpg"
    );
  });

  it("replaces a failed image with an accessible fallback", () => {
    render(
      <PublicResponsiveImage
        source="https://images.example.edu/failure.jpg"
        intent="featured-card"
        alt="Failed image"
        loadMode="eager"
      />
    );

    fireEvent.error(screen.getByRole("img", { name: "Failed image" }));

    expect(screen.getByRole("img", { name: "Failed image" })).toHaveAttribute("data-public-image-fallback", "true");
    expect(document.querySelector('[data-public-responsive-image-element="true"]')).not.toBeInTheDocument();
  });

  it("honors the page media gate unless explicitly bypassed", async () => {
    const { container, rerender } = render(
      <PublicMediaLoadingProvider pageMediaAllowed={false}>
        <PublicResponsiveImage
          source="https://images.example.edu/gated.jpg"
          intent="content-featured"
          alt="Gated image"
          loadMode="critical"
        />
      </PublicMediaLoadingProvider>
    );

    expect(screen.queryByRole("img", { name: "Gated image" })).not.toBeInTheDocument();

    rerender(
      <PublicMediaLoadingProvider pageMediaAllowed>
        <PublicResponsiveImage
          source="https://images.example.edu/gated.jpg"
          intent="content-featured"
          alt="Gated image"
          loadMode="critical"
        />
      </PublicMediaLoadingProvider>
    );

    await waitFor(() => {
      expect(container.querySelector('img[src="https://images.example.edu/gated.jpg"]')).toBeInTheDocument();
    });
  });
});

describe("PublicDeferredEmbed", () => {
  it("does not assign iframe src until the stable slot nears the viewport", async () => {
    const { container } = render(
      <PublicDeferredEmbed
        src="https://www.youtube.com/embed/test"
        title="Deferred video"
        sx={{ width: "100%", height: 390 }}
        allow="autoplay"
        allowFullScreen
      />
    );

    const slot = container.querySelector('[data-public-deferred-embed="true"]') as Element;
    expect(screen.queryByTitle("Deferred video")).not.toBeInTheDocument();
    expect(slot).toHaveStyle({ height: "390px" });

    act(() => {
      TestIntersectionObserver.instances[0].trigger(slot);
    });

    const iframe = await screen.findByTitle("Deferred video");
    expect(iframe).toHaveAttribute("src", "https://www.youtube.com/embed/test");
    expect(iframe).toHaveAttribute("allow", "autoplay");
    expect(iframe).toHaveAttribute("allowfullscreen");
  });

  it("rejects unsafe iframe resources", () => {
    const { container } = render(
      <PublicDeferredEmbed src="javascript:alert(1)" title="Unsafe frame" loadMode="eager" sx={{ height: 300 }} />
    );

    expect(screen.queryByTitle("Unsafe frame")).not.toBeInTheDocument();
    expect(container.querySelector('[data-public-embed-placeholder="true"]')).toBeInTheDocument();
  });

  it("unobserves a pending slot when it is removed", () => {
    const { unmount } = render(
      <PublicDeferredEmbed src="https://www.youtube.com/embed/cleanup" title="Cleanup frame" sx={{ height: 300 }} />
    );
    const observer = TestIntersectionObserver.instances[0];

    unmount();

    expect(observer.unobserve).toHaveBeenCalledTimes(1);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });
});
