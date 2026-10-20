import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicContentCardItem } from "../../../types";
import { ProgramsSection } from "./ProgramsSection";

function createProgram(overrides: Partial<PublicContentCardItem> = {}): PublicContentCardItem {
  return {
    id: "program-1",
    title: "เทคโนโลยีธุรกิจดิจิทัล",
    slug: "digital-business-technology",
    type: "program",
    status: "published",
    owner: "Admin",
    summary: "หลักสูตรที่เปิดสอน",
    category: "สาขาวิชา",
    tags: [],
    publishAt: "2026-10-20T00:00:00.000Z",
    ...overrides
  };
}

describe("homepage programs section visibility", () => {
  it("hides the entire section when there are no published programs", () => {
    const { container } = render(<ProgramsSection items={[]} mediaAssets={[]} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("สาขาวิชาที่เปิดสอน")).not.toBeInTheDocument();
  });

  it("does not show draft or incomplete program content", () => {
    const { container } = render(
      <ProgramsSection
        items={[createProgram({ status: "draft" }), createProgram({ id: "program-2", slug: "" })]}
        mediaAssets={[]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the renamed section when a published program exists", () => {
    render(<ProgramsSection items={[createProgram()]} mediaAssets={[]} />);

    expect(screen.getByText("สาขาวิชาที่เปิดสอน")).toBeInTheDocument();
    expect(screen.getByText("เทคโนโลยีธุรกิจดิจิทัล")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /เทคโนโลยีธุรกิจดิจิทัล/ })).toHaveAttribute(
      "href",
      "/content/digital-business-technology"
    );
  });
});
