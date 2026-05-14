import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicIntroGate from "../public/components/PublicIntroGate";
import { HomepageIntroGateSettings } from "../types";

const dialogName = "หน้าแนะนำก่อนเข้าสู่เว็บไซต์";

function createSettings(overrides: Partial<HomepageIntroGateSettings> = {}): HomepageIntroGateSettings {
  return {
    enabled: true,
    imageUrl: "https://example.edu/intro.jpg",
    imageAlt: "ภาพแนะนำ",
    primaryButtonLabel: "เข้าสู่เว็บไซต์หลัก",
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
  it("stays hidden until enabled settings with an image arrive", () => {
    const { rerender } = render(<PublicIntroGate />);

    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();

    rerender(<PublicIntroGate settings={createSettings({ enabled: false })} />);

    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();

    rerender(<PublicIntroGate settings={createSettings()} />);

    expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "ภาพแนะนำ" })).toHaveAttribute("src", "https://example.edu/intro.jpg");
  });

  it("does not require a page refresh when async settings become available", () => {
    const { rerender } = render(<PublicIntroGate settings={undefined} />);

    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();

    rerender(<PublicIntroGate settings={createSettings({ storageKey: "async-intro" })} />);

    expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
  });

  it("stores dismissal and hides after the primary enter button is clicked", () => {
    render(<PublicIntroGate settings={createSettings()} />);

    fireEvent.click(screen.getByRole("button", { name: /เข้าสู่เว็บไซต์หลัก/ }));

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

    fireEvent.click(screen.getByRole("button", { name: /เข้าสู่เว็บไซต์หลัก/ }));

    expect(storageMock.setItem).toHaveBeenCalledWith("throwing-storage", "dismissed");
    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();
  });
});
