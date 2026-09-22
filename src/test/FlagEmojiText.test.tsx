import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FlagEmojiText, { getCountryFlagAssetUrl } from "../shared/media/FlagEmojiText";

describe("FlagEmojiText", () => {
  it("renders country flag sequences with pinned Twemoji SVG assets", () => {
    render(<FlagEmojiText>ไทย 🇹🇭 ญี่ปุ่น 🇯🇵 ✅</FlagEmojiText>);

    const thailand = screen.getByAltText("🇹🇭");
    const japan = screen.getByAltText("🇯🇵");

    expect(thailand).toHaveAttribute(
      "src",
      "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/1f1f9-1f1ed.svg"
    );
    expect(japan).toHaveAttribute(
      "src",
      "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/1f1ef-1f1f5.svg"
    );
    expect(screen.getByText(/ไทย/)).toBeInTheDocument();
    expect(screen.getByText(/✅/)).toBeInTheDocument();
  });

  it("falls back to the original flag text when the SVG cannot load", () => {
    render(<FlagEmojiText>ประเทศไทย 🇹🇭</FlagEmojiText>);

    fireEvent.error(screen.getByAltText("🇹🇭"));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/🇹🇭/)).toBeInTheDocument();
  });

  it("does not turn non-flag emoji into images", () => {
    render(<FlagEmojiText>📢 ✅ 🎉</FlagEmojiText>);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("📢 ✅ 🎉")).toBeInTheDocument();
  });

  it("does not return an asset URL for a single regional indicator", () => {
    expect(getCountryFlagAssetUrl("🇹")).toBe("");
  });
});
