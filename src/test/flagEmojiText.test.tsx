import { renderToString } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FlagEmojiText from "../shared/components/FlagEmojiText";
import { getFlagEmojiAssetUrl } from "../utils/flagEmoji";

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
    expect(screen.getByRole("img", { name: "🇹🇭" })).toHaveAttribute(
      "src",
      "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/1f1f9-1f1ed.svg"
    );
    expect(screen.getByRole("img", { name: "🇯🇵" })).toHaveAttribute(
      "src",
      "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/1f1ef-1f1f5.svg"
    );
  });

  it("keeps flag image wrappers valid inside phrasing content for SSR hydration", () => {
    const markup = renderToString(
      <p>
        <FlagEmojiText text="ไทย 🇹🇭 และญี่ปุ่น 🇯🇵" />
      </p>
    );
    const container = document.createElement("div");
    container.innerHTML = markup;

    const paragraph = container.querySelector("p");
    const wrappers = [...container.querySelectorAll('[data-public-responsive-image="true"]')];

    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(wrappers).toHaveLength(2);
    expect(wrappers.every((wrapper) => wrapper.tagName === "SPAN")).toBe(true);
    expect(wrappers.every((wrapper) => paragraph?.contains(wrapper))).toBe(true);
  });

  it("falls back to the original flag text if the asset cannot load", () => {
    render(<FlagEmojiText text="ประเทศไทย 🇹🇭" />);

    const flagImage = screen.getByRole("img", { name: "🇹🇭" });
    fireEvent.error(flagImage);

    expect(document.querySelector('[data-public-image-fallback="true"]')).toBeInTheDocument();
    expect(screen.getByText("🇹🇭")).toBeInTheDocument();
  });
});
