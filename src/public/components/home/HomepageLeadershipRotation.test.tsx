import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSiteSettings } from "../../../services/siteSettings";
import { HomepageLeadershipRotation } from "./HomepageLeadershipRotation";

const siteSettings = {
  ...defaultSiteSettings,
  directorName: "Director A",
  directorTitle: "Principal",
  leadership: {
    autoplayIntervalSeconds: 6,
    deputies: [
      { enabled: true, name: "Deputy B", title: "Vice Principal", description: "B", imageUrl: "" },
      { enabled: false, name: "Hidden C", title: "Vice Principal", description: "", imageUrl: "" },
      { enabled: true, name: "Deputy D", title: "Vice Principal", description: "D", imageUrl: "" },
      { enabled: false, name: "", title: "", description: "", imageUrl: "" }
    ]
  }
};

const imageSettings = {
  ...siteSettings,
  leadership: {
    ...siteSettings.leadership,
    deputies: [
      {
        enabled: true,
        name: "Deputy B",
        title: "Vice Principal",
        description: "B",
        imageUrl: "https://images.example.test/deputy-b.jpg"
      },
      ...siteSettings.leadership.deputies.slice(1)
    ]
  }
};

class DeferredImage {
  static instances: DeferredImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";

  constructor() {
    DeferredImage.instances.push(this);
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  DeferredImage.instances = [];
});

describe("HomepageLeadershipRotation", () => {
  it("rotates director, deputy 1, deputy 3, then director every six seconds", () => {
    vi.useFakeTimers();
    render(<HomepageLeadershipRotation siteSettings={siteSettings} />);
    expect(screen.getByText("Director A")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6_000));
    expect(screen.getByText("Deputy B")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6_000));
    expect(screen.getByText("Deputy D")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6_000));
    expect(screen.getByText("Director A")).toBeInTheDocument();
  });

  it("crossfades complete matching records for exactly 550ms", () => {
    vi.useFakeTimers();
    const { container } = render(<HomepageLeadershipRotation siteSettings={siteSettings} />);
    fireEvent.click(screen.getByRole("button", { name: "ผู้บริหารถัดไป" }));

    const outgoing = container.querySelector('[data-leadership-layer="outgoing"]');
    const incoming = container.querySelector('[data-leadership-layer="current"]');
    expect(outgoing).toHaveAttribute("aria-hidden", "true");
    expect(outgoing).toHaveTextContent("Director A");
    expect(incoming).toHaveTextContent("Deputy B");
    expect(incoming).toHaveTextContent("Vice Principal");
    expect(incoming).toHaveTextContent("B");

    act(() => vi.advanceTimersByTime(549));
    expect(container.querySelector('[data-leadership-layer="outgoing"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[data-leadership-layer="outgoing"]')).toBeNull();
    expect(container.querySelectorAll('[data-leadership-layer="current"]')).toHaveLength(1);
  });

  it("pauses while hovered, allows manual navigation and keyboard arrows, and handles quick clicks", () => {
    vi.useFakeTimers();
    render(<HomepageLeadershipRotation siteSettings={siteSettings} />);
    const carousel = screen.getByRole("region", { name: "ผู้บริหารสถานศึกษา" });
    fireEvent.mouseEnter(carousel);
    act(() => vi.advanceTimersByTime(12_000));
    expect(screen.getByText("Director A")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ผู้บริหารถัดไป" }));
    expect(screen.getByText("Deputy B")).toBeInTheDocument();
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(screen.getByText("Director A")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(550));
    expect(screen.queryByText("Deputy B")).not.toBeInTheDocument();
  });

  it("keeps the displayed record while an image loads, then transitions after preload", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Image", DeferredImage);
    const { container } = render(<HomepageLeadershipRotation siteSettings={imageSettings} />);
    expect(DeferredImage.instances).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "ผู้บริหารถัดไป" }));
    expect(screen.getByText("Director A")).toBeInTheDocument();
    expect(screen.queryByText("Deputy B")).not.toBeInTheDocument();

    await act(async () => {
      DeferredImage.instances[0].onload?.();
    });

    expect(screen.getByText("Deputy B")).toBeInTheDocument();
    expect(container.querySelector('[data-leadership-layer="outgoing"]')).toHaveTextContent("Director A");
    act(() => vi.advanceTimersByTime(550));
    expect(container.querySelector('[data-leadership-layer="outgoing"]')).toBeNull();
  });

  it("moves forward after a bounded failed image preload without freezing the carousel", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Image", DeferredImage);
    render(<HomepageLeadershipRotation siteSettings={imageSettings} />);
    fireEvent.click(screen.getByRole("button", { name: "ผู้บริหารถัดไป" }));
    expect(screen.getByText("Director A")).toBeInTheDocument();

    await act(async () => {
      DeferredImage.instances[0].onerror?.();
    });
    expect(screen.getByText("Deputy B")).toBeInTheDocument();
  });

  it("ignores a stale image load after navigating to another portrait", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Image", DeferredImage);
    render(<HomepageLeadershipRotation siteSettings={imageSettings} />);
    fireEvent.click(screen.getByRole("button", { name: "ผู้บริหารถัดไป" }));
    fireEvent.click(screen.getByRole("button", { name: "ผู้บริหารก่อนหน้า" }));
    expect(screen.getByText("Deputy D")).toBeInTheDocument();

    await act(async () => {
      DeferredImage.instances[0].onload?.();
    });
    expect(screen.getByText("Deputy D")).toBeInTheDocument();
    expect(screen.queryByText("Deputy B")).not.toBeInTheDocument();
  });

  it("honors reduced motion with instant manual changes and paused autoplay", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    const { container } = render(<HomepageLeadershipRotation siteSettings={siteSettings} />);

    act(() => vi.advanceTimersByTime(12_000));
    expect(screen.getByText("Director A")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ผู้บริหารถัดไป" }));
    expect(screen.getByText("Deputy B")).toBeInTheDocument();
    expect(container.querySelector('[data-leadership-layer="outgoing"]')).toBeNull();
  });

  it("keeps a director-only legacy card static and hides unnecessary controls", () => {
    vi.useFakeTimers();
    render(<HomepageLeadershipRotation siteSettings={{ ...defaultSiteSettings, directorName: "Original" }} />);
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ผู้บริหารถัดไป" })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText("Original")).toBeInTheDocument();
  });
});
