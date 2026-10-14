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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  it("pauses while hovered, allows manual navigation and keyboard arrows", () => {
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
