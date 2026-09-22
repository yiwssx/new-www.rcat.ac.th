import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FlagEmojiText, { getFlagEmojiAssetUrl } from "../shared/components/FlagEmojiText";

describe("FlagEmojiText", () => {
  it("maps regional-indicator flags to pinned Twemoji SVG assets", () => {
    expect(getFlagEmojiAssetUrl("🇹🇭")).toBe(
      "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/1f1f9-1f1ed.svg"
    );
    expect(getFlagEmojiAssetUrl("🇯🇵")).toBe(
      "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/1f1ef-1f1f5.svg"
    );
    expect(getFlagEmojiAssetUrl("✅")).toBe("");
  });

  it("renders country flags as images while preserving surrounding text", () => {
    render(<FlagEmojiText text="ไทย 🇹🇭 และญี่ปุ่น 🇯🇵" />);

    expect(screen.getByText(/ไทย/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "🇹🇭" })).toHaveAttribute("data-country-flag", "th");
    expect(screen.getByRole("img", { name: "🇯🇵" })).toHaveAttribute("data-country-flag", "jp");
  });

  it("falls back to the original flag text if the asset cannot load", () => {
    render(<FlagEmojiText text="ประเทศไทย 🇹🇭" />);

    const flagImage = screen.getByRole("img", { name: "🇹🇭" });
    const imageElement = flagImage.querySelector('[data-public-responsive-image-element="true"]');

    expect(imageElement).not.toBeNull();
    fireEvent.error(imageElement as Element);

    expect(document.querySelector('[data-public-image-fallback="true"]')).toBeInTheDocument();
    expect(screen.getByText("🇹🇭")).toBeInTheDocument();
  });
});
