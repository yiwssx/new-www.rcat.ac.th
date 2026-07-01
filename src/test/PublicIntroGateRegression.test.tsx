import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicIntroGate from "../public/components/PublicIntroGate";
import type { HomepageIntroGateSettings } from "../types";

const dialogName = "หน้าแนะนำก่อนเข้าสู่เว็บไซต์";
const imageAlt = "ภาพแนะนำ";
const primaryButtonLabel = "เข้าสู่เว็บไซต์หลัก";
const loadingMessage = "กำลังโหลดภาพประชาสัมพันธ์";
const errorMessage = "ไม่สามารถโหลดภาพประชาสัมพันธ์ได้";

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

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PublicIntroGate regressions", () => {
  it("renders a normalized image for a valid stable HTTPS imageUrl", () => {
    render(<PublicIntroGate settings={createSettings()} />);

    const introImage = screen.getByRole("img", { name: imageAlt });

    expect(introImage).toHaveAttribute("src", "https://example.edu/intro.jpg");
    expect(introImage).toHaveAttribute("loading", "eager");
    expect(introImage).toHaveAttribute("fetchpriority", "high");
    expect(introImage).toHaveAttribute("decoding", "async");
    expect(screen.getByText(loadingMessage)).toBeInTheDocument();
  });

  it("renders a stable relative intro image path", () => {
    render(<PublicIntroGate settings={createSettings({ imageUrl: "/intro/intro-gate-2026.webp" })} />);

    expect(screen.getByRole("img", { name: imageAlt })).toHaveAttribute("src", "/intro/intro-gate-2026.webp");
  });

  it("converts a Google Drive file share URL to a thumbnail image URL", () => {
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
        "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w640 640w",
        "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w900 900w",
        "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w1200 1200w",
        "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w1600 1600w"
      ].join(", ")
    );
    expect(screen.getByRole("img", { name: imageAlt })).toHaveAttribute("sizes", "96vw");
  });

  it("accepts an existing Google Drive thumbnail image URL", () => {
    render(
      <PublicIntroGate
        settings={createSettings({
          imageUrl: "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w400"
        })}
      />
    );

    expect(screen.getByRole("img", { name: imageAlt })).toHaveAttribute(
      "src",
      "https://drive.google.com/thumbnail?id=RCAT_intro-2026_ABC123&sz=w1600"
    );
  });

  it.each(["https://fbcdn.net/intro-gate.jpg", "https://scontent.fkkc3-1.fna.fbcdn.net/v/t39.30808-6/intro-gate.jpg"])(
    "rejects direct Facebook CDN intro image URL %s",
    (imageUrl) => {
      render(
        <PublicIntroGate
          settings={createSettings({
            imageUrl
          })}
        />
      );

      expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    }
  );

  it("keeps the enter button usable when a Facebook CDN image URL is rejected", () => {
    render(
      <PublicIntroGate
        settings={createSettings({
          imageUrl: "https://scontent.fkkc3-1.fna.fbcdn.net/v/t39.30808-6/intro-gate.jpg",
          storageKey: "intro-fbcdn-dismiss"
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: primaryButtonLabel }));

    expect(window.sessionStorage.getItem("intro-fbcdn-dismiss")).toBe("dismissed");
    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,abc", "file:///C:/intro.webp", "//example.com/intro.webp"])(
    "does not render a broken image when imageUrl is unsafe: %s",
    (imageUrl) => {
      render(<PublicIntroGate settings={createSettings({ imageUrl })} />);

      expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    }
  );

  it("shows a fallback message when the intro image fails to load", () => {
    render(<PublicIntroGate settings={createSettings()} />);

    fireEvent.error(screen.getByRole("img", { name: imageAlt }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("keeps the enter button usable after the intro image fails", () => {
    render(<PublicIntroGate settings={createSettings({ storageKey: "intro-error-dismiss" })} />);

    fireEvent.error(screen.getByRole("img", { name: imageAlt }));
    fireEvent.click(screen.getByRole("button", { name: primaryButtonLabel }));

    expect(window.sessionStorage.getItem("intro-error-dismiss")).toBe("dismissed");
    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();
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

  it("stores dismissal and hides after the primary enter button is clicked", () => {
    render(<PublicIntroGate settings={createSettings()} />);

    fireEvent.click(screen.getByRole("button", { name: primaryButtonLabel }));

    expect(window.sessionStorage.getItem("intro-regression")).toBe("dismissed");
    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: primaryButtonLabel }));

    expect(storageMock.setItem).toHaveBeenCalledWith("throwing-storage", "dismissed");
    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();
  });
});
