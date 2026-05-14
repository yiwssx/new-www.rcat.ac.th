import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicContentCard from "../public/components/PublicContentCard";
import { DocumentListCard } from "../public/components/home/DocumentListCard";
import { EventListCard } from "../public/components/home/EventListCard";
import { LatestAnnouncementsCard } from "../public/components/home/LatestAnnouncementsCard";
import { CalendarEvent, ContentItem, MediaAsset } from "../types";

function createContentItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "content-1",
    title: "Public card title",
    slug: "public-card-title",
    type: "news",
    status: "published",
    owner: "Public team",
    summary: "Public summary text for the card.",
    category: "General",
    tags: ["student", "news"],
    readingMinutes: 3,
    updatedAt: "2026-05-10T00:00:00.000Z",
    publishAt: "2026-05-10T00:00:00.000Z",
    ...overrides
  };
}

function createMediaAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "media-1",
    name: "Card image",
    type: "image",
    size: "120 KB",
    owner: "Public team",
    driveUrl: "https://drive.google.com/file/d/media-1/view",
    previewUrl: "https://example.edu/card-image.jpg",
    embedUrl: "",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides
  };
}

describe("public card layout regressions", () => {
  it("keeps the public content card as a full-card link with stable media and text", () => {
    const item = createContentItem({
      featuredMediaId: "media-1"
    });

    render(<PublicContentCard item={item} mediaAssets={[createMediaAsset()]} />);

    const cardLink = screen.getByRole("link", { name: /Public card title/ });

    expect(cardLink).toHaveAttribute("href", "/content/public-card-title");
    expect(cardLink).toHaveClass("rcat-card", "block", "h-full");
    expect(within(cardLink).getByRole("img", { name: "Card image" })).toHaveAttribute(
      "src",
      "https://example.edu/card-image.jpg"
    );
    expect(within(cardLink).getByRole("img", { name: "Card image" })).toHaveClass("h-full", "w-full", "object-cover");
    expect(within(cardLink).getByText("Public summary text for the card.")).toHaveClass("content-summary");
    expect(within(cardLink).getByText("#student #news")).toBeInTheDocument();
    expect(within(cardLink).getByText("Public team")).toBeInTheDocument();
  });

  it("keeps compact announcement rows as accessible focused links inside a public card", () => {
    render(
      <LatestAnnouncementsCard
        items={[
          createContentItem({
            id: "announcement-1",
            title: "Admissions announcement",
            slug: "admissions-announcement",
            type: "announcement",
            category: "Admissions",
            featured: true
          })
        ]}
      />
    );

    const card = screen.getByText("Admissions announcement").closest(".rcat-card");
    const link = screen.getByRole("link", { name: /Admissions announcement/ });

    expect(card).not.toBeNull();
    expect(link).toHaveAttribute("href", "/content/admissions-announcement");
    expect(link).toHaveClass("rcat-focus-ring", "block");
    expect(within(link).getByText("Admissions")).toBeInTheDocument();
  });

  it("keeps document rows visually framed while preserving document links", () => {
    render(
      <DocumentListCard
        items={[
          createContentItem({
            id: "document-1",
            title: "Action plan document",
            slug: "action-plan-document",
            type: "page",
            category: "Planning"
          })
        ]}
      />
    );

    const documentLink = screen.getByRole("link", { name: /Action plan document/ });

    expect(screen.getByText("Action plan document").closest(".rcat-card")).not.toBeNull();
    expect(documentLink).toHaveAttribute("href", "/content/action-plan-document");
    expect(documentLink).toHaveClass("rcat-card-muted", "rcat-focus-ring", "block");
    expect(within(documentLink).getByText("Planning")).toBeInTheDocument();
  });

  it("keeps event list content inside the calendar card without introducing links", () => {
    const events: CalendarEvent[] = [
      {
        id: "event-1",
        title: "Orientation day",
        date: "2026-05-20T09:00:00.000Z",
        audience: "public",
        status: "confirmed",
        location: "Main hall",
        visibility: "public"
      }
    ];

    render(<EventListCard items={events} />);

    expect(screen.getByText("Orientation day").closest(".rcat-card")).not.toBeNull();
    expect(screen.getByText("Main hall")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Orientation day/ })).not.toBeInTheDocument();
  });
});
