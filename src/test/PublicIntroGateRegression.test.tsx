import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicIntroGate from "../public/components/PublicIntroGate";
import type { HomepageIntroGateSettings } from "../types";

const dialogName = "หน้าแนะนำก่อนเข้าสู่เว็บไซต์";
const imageAlt = "ภาพแนะนำ";
const primaryButtonLabel = "เข้าสู่เว็บไซต์หลัก";
const errorMessage = "ไม่สามารถแสดงภาพประชาสัมพันธ์ได้";
const workerBaseUrl = "https://rcat-image-test.rcat-digital.workers.dev";

function createSettings(overrides: Partial<HomepageIntroGateSettings> = {}): HomepageIntroGateSettings {
  return {
    enabled: true,
    imageUrl: "https://example.edu/intro.jpg",
    imageAlt,
    primaryButtonLabel,
    secondaryButtonLabel: "",
    secondaryButtonUrl: "",
    storageKey: "intro-regression",
    ...overrides
  };
}

function markIntroImageLoaded() {
  fireEvent.load(screen.getByRole("img", { name: imageAlt }));
}

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("PublicIntroGate regressions", () => {
  it("renders a critical image without exposing loading copy or an early enter action", () => {
    render(<PublicIntroGate settings={createSettings()} />);

    const introImage = screen.getByRole("img", { name: imageAlt });
    const responsiveImage = introImage.closest('[data-public-responsive-image="true"]');
    const imageRegion = document.querySelector('[data-intro-gate-image-region="true"]');

    expect(introImage).toHaveAttribute("src", "https://example.edu/intro.jpg");
    expect(introImage).toHaveAttribute("loading", "eager");
    expect(introImage).toHaveAttribute("fetchpriority", "high");
    expect(introImage).toHaveAttribute("decoding", "async");
    expect(responsiveImage).toHaveAttribute("data-public-image-layout", "intrinsic");
    expect(responsiveImage).toHaveAttribute("data-public-image-fill", "false");
    expect(imageRegion).toHaveAttribute("data-intro-gate-image-sizing", "intrinsic-constrained");
    expect(window.getComputedStyle(introImage).objectFit).toBe("contain");
    expect(document.querySelector('[data-intro-gate-loading-shell="true"]')).toBeInTheDocument();
    expect(screen.queryByText(/กำลังโหลดภาพประชาสัมพันธ์/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: primaryButtonLabel })).not.toBeInTheDocument();

    markIntroImageLoaded();

    expect(screen.getByRole("button", { name: primaryButtonLabel })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: dialogName })).toHaveAttribute("data-intro-gate-image-status", "loaded");
  });

  it("renders single and secondary action layouts only after the mandatory image is ready", () => {
    const { rerender } = render(<PublicIntroGate settings={createSettings()} />);
    expect(document.querySelector('[data-intro-gate-actions="true"]')).not.toBeInTheDocument();

    markIntroImageLoaded();
    let actions = document.querySelector('[data-intro-gate-actions="true"]') as HTMLElement;

    expect(actions).toHaveAttribute("data-intro-gate-has-secondary", "false");
    expect(within(actions).getAllByRole("button")).toHaveLength(1);
    expect(within(actions).queryByRole("link")).not.toBeInTheDocument();

    rerender(
      <PublicIntroGate
        settings={createSettings({
          secondaryButtonLabel: "อ่านรายละเอียด",
          secondaryButtonUrl: "https://example.edu/details"
        })}
      />
    );
    actions = document.querySelector('[data-intro-gate-actions="true"]') as HTMLElement;

    expect(actions).toHaveAttribute("data-intro-gate-has-secondary", "true");
    expect(within(actions).getByRole("button", { name: primaryButtonLabel })).toBeInTheDocument();
    expect(within(actions).getByRole("link", { name: /อ่านรายละเอียด/ })).toHaveAttribute(
      "href",
      "https://example.edu/details"
    );
  });

  it("renders a stable relative intro image path", () => {
    render(<PublicIntroGate settings={createSettings({ imageUrl: "/intro/intro-gate-2026.webp" })} />);

    expect(screen.getByRole("img", { name: imageAlt })).toHaveAttribute("src", "/intro/intro-gate-2026.webp");
  });

  it("converts a Google Drive file share URL to a thumbnail image URL when Worker rollout is disabled", () => {
    render(
      <PublicIntroGate
        settings={createSettings({
          imageUrl: "https://drive.google.com/file/d/RCAT_intro-2026_ABC123/view?usp=sharing"
        })}
      />
    );

    expect(screen.getByRole("img", { name: imageAlt })).toHaveAttribute(
      "src",
      "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w1600"
    );
    expect(screen.getByRole("img", { name: imageAlt })).toHaveAttribute(
      "srcset",
      [
        "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w480 480w",
        "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w640 640w",
        "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w900 900w",
        "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w1200 1200w",
        "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w1600 1600w"
      ].join(", ")
    );
    expect(screen.getByRole("img", { name: imageAlt })).toHaveAttribute("sizes", "96vw");
  });

  it("falls back from the Worker to the same Drive image before reporting IntroGate failure", () => {
    vi.stubEnv("VITE_PUBLIC_IMAGE_DELIVERY_BASE_URL", workerBaseUrl);
    vi.stubEnv("VITE_PUBLIC_IMAGE_DELIVERY_INTENTS", "intro-gate");

    render(
      <PublicIntroGate
        settings={createSettings({
          imageUrl: "https://drive.google.com/file/d/RCAT_intro-2026_ABC123/view?usp=sharing"
        })}
      />
    );

    const workerImage = screen.getByRole("img", { name: imageAlt });
    expect(workerImage).toHaveAttribute("src", `${workerBaseUrl}/image/RCAT_intro-2026_ABC123?w=1600`);

    fireEvent.error(workerImage);

    const driveImage = screen.getByRole("img", { name: imageAlt });
    expect(driveImage).toHaveAttribute(
      "src",
      "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w1600"
    );
    expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: primaryButtonLabel })).not.toBeInTheDocument();

    fireEvent.load(driveImage);
    expect(screen.getByRole("button", { name: primaryButtonLabel })).toBeInTheDocument();
  });

  it.each(["https://fbcdn.net/intro-gate.jpg", "https://scontent.fkkc3-1.fna.fbcdn.net/v/t39.30808-6/intro-gate.jpg"])(
    "rejects direct Facebook CDN intro image URL %s without allowing bypass",
    (imageUrl) => {
      render(<PublicIntroGate settings={createSettings({ imageUrl })} />);

      expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: primaryButtonLabel })).not.toBeInTheDocument();
    }
  );

  it.each(["javascript:alert(1)", "data:image/png;base64,abc", "file:///C:/intro.webp", "//example.com/intro.webp"])(
    "does not render a broken image or bypass action when imageUrl is unsafe: %s",
    (imageUrl) => {
      render(<PublicIntroGate settings={createSettings({ imageUrl })} />);

      expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: primaryButtonLabel })).not.toBeInTheDocument();
    }
  );

  it("shows a retry action when both delivery paths fail and still prevents site entry", () => {
    render(<PublicIntroGate settings={createSettings()} />);

    fireEvent.error(screen.getByRole("img", { name: imageAlt }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ลองโหลดอีกครั้ง" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: primaryButtonLabel })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ลองโหลดอีกครั้ง" }));
    expect(screen.getByRole("img", { name: imageAlt })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: primaryButtonLabel })).not.toBeInTheDocument();
  });

  it("stays hidden until enabled settings with an image arrive", () => {
    const { rerender } = render(<PublicIntroGate />);

    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();

    rerender(<PublicIntroGate settings={createSettings({ enabled: false })} />);

    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();

    rerender(<PublicIntroGate settings={createSettings()} />);

    expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: imageAlt })).toHaveAttribute("src", "https://example.edu/intro.jpg");
  });

  it("does not require a page refresh when async settings become available", () => {
    const { rerender } = render(<PublicIntroGate settings={undefined} />);

    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();

    rerender(<PublicIntroGate settings={createSettings({ storageKey: "async-intro" })} />);

    expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
  });

  it("stores dismissal and hides only after the mandatory image has loaded", () => {
    render(<PublicIntroGate settings={createSettings()} />);

    expect(screen.queryByRole("button", { name: primaryButtonLabel })).not.toBeInTheDocument();
    markIntroImageLoaded();
    fireEvent.click(screen.getByRole("button", { name: primaryButtonLabel }));

    expect(window.sessionStorage.getItem("intro-regression")).toBe("dismissed");
    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();
  });

  it("restores body scroll locking styles and scroll position after dismissal", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(240);
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "clip";
    document.body.style.position = "relative";
    document.body.style.top = "3px";
    document.body.style.width = "90%";

    render(<PublicIntroGate settings={createSettings({ storageKey: "scroll-lock-intro" })} />);

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-240px");
    expect(document.body.style.width).toBe("100%");

    markIntroImageLoaded();
    fireEvent.click(screen.getByRole("button", { name: primaryButtonLabel }));

    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.body.style.overflow).toBe("clip");
    expect(document.body.style.position).toBe("relative");
    expect(document.body.style.top).toBe("3px");
    expect(document.body.style.width).toBe("90%");
    expect(scrollTo).toHaveBeenCalledWith(0, 240);
  });

  it("does not show when sessionStorage already has a dismissed marker for the current storage key", () => {
    window.sessionStorage.setItem("intro-regression", "dismissed");

    render(<PublicIntroGate settings={createSettings()} />);

    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();
  });

  it("re-evaluates visibility when the storage key changes", () => {
    window.sessionStorage.setItem("intro-dismissed", "dismissed");
    const { rerender } = render(<PublicIntroGate settings={createSettings({ storageKey: "intro-dismissed" })} />);

    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();

    rerender(<PublicIntroGate settings={createSettings({ storageKey: "intro-new" })} />);

    expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
  });

  it("still hides through in-memory dismissed keys when sessionStorage throws on click", () => {
    const storageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("storage disabled");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0
    } satisfies Storage;

    vi.stubGlobal("sessionStorage", storageMock);

    Object.defineProperty(window, "sessionStorage", {
      value: storageMock,
      configurable: true
    });

    storageMock.setItem.mockImplementation(() => {
      throw new Error("storage disabled");
    });

    render(<PublicIntroGate settings={createSettings({ storageKey: "throwing-storage" })} />);

    markIntroImageLoaded();
    fireEvent.click(screen.getByRole("button", { name: primaryButtonLabel }));

    expect(storageMock.setItem).toHaveBeenCalledWith("throwing-storage", "dismissed");
    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();
  });
});
