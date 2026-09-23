import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicResponsiveImage from "./PublicResponsiveImage";

const source = {
  type: "image",
  previewUrl: "https://images.example.test/managed-image.jpg",
  altText: "นักเรียนกำลังทำกิจกรรมในแปลงเกษตร"
};

describe("PublicResponsiveImage managed alt text", () => {
  it("prefers managed media alt text over a filename-style fallback", () => {
    render(<PublicResponsiveImage source={source} intent="content-body" alt="managed-image.jpg" loadMode="eager" />);

    expect(screen.getByRole("img", { name: source.altText })).toHaveAttribute(
      "src",
      "https://images.example.test/managed-image.jpg"
    );
  });

  it("preserves explicit empty alt for decorative images", () => {
    const { container } = render(
      <PublicResponsiveImage source={source} intent="content-body" alt="" loadMode="eager" />
    );

    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.queryByRole("img", { name: source.altText })).not.toBeInTheDocument();
  });
});
