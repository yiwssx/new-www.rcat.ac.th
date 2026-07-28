import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PublicContentCard from "../public/components/PublicContentCard";
import { DocumentListCard } from "../features/public-documents";
import { EventListCard } from "../public/components/home/EventListCard";
import { LatestAnnouncementsCard } from "../public/components/home/LatestAnnouncementsCard";
import { CalendarEvent, ContentItem, MediaAsset, PublicDocumentItem } from "../types";

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

function createPublicDocumentItem(overrides: Partial<PublicDocumentItem> = {}): PublicDocumentItem {
  return {
    id: "document-1",
    title: "Public file document",
    description: "Document description",
    category: "Policy",
    fileUrl: "https://example.edu/public-file.pdf",
    fileName: "public-file.pdf",
    mediaId: "media-1",
    publishedAt: "2026-05-10T00:00:00.000Z",
    order: 1,
    pinned: false,
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

  it("uses the thumbnail source and small Drive policy for regular and featured cards", () => {
    const item = createContentItem({ featuredMediaId: "media-1" });
    const asset = createMediaAsset({
      thumbnailUrl: "https://drive.google.com/file/d/card-thumbnail-source/view",
      previewUrl: "https://drive.google.com/file/d/card-preview-source/view"
    });
    const { rerender } = render(<PublicContentCard item={item} mediaAssets={[asset]} />);

    let image = screen.getByRole("img", { name: "Card image" });
    expect(image).toHaveAttribute("src", "https://drive.google.com/thumbnail?id=card-thumbnail-source&sz=w320");
    expect(image.getAttribute("srcset")).toContain("sz=w160 160w");
    expect(image.getAttribute("srcset")).not.toContain("card-preview-source");

    rerender(<PublicContentCard item={item} mediaAssets={[asset]} featured />);

    image = screen.getByRole("img", { name: "Card image" });
    expect(image).toHaveAttribute("src", "https://drive.google.com/thumbnail?id=card-thumbnail-source&sz=w640");
    expect(image.getAttribute("srcset")).toContain("sz=w320 320w");
  });

  it("shows a Facebook badge for Facebook imported content without rendering an iframe in cards", () => {
    const item = createContentItem({
      template: "facebook-embed",
      canonicalUrl: "https://www.facebook.com/100063746585360/posts/111"
    });

    const { container } = render(<PublicContentCard item={item} mediaAssets={[]} />);

    const cardLink = screen.getByRole("link", { name: /Public card title/ });

    expect(within(cardLink).getByText("Facebook")).toBeInTheDocument();
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("shows the Facebook badge only when the resolved template is Facebook Embed", () => {
    const { rerender } = render(
      <PublicContentCard
        item={createContentItem({ template: "standard", canonicalUrl: "https://www.facebook.com/rcat/posts/111" })}
        mediaAssets={[]}
      />
    );

    expect(screen.queryByText("Facebook")).not.toBeInTheDocument();

    rerender(
      <PublicContentCard
        item={createContentItem({ template: "", canonicalUrl: "https://www.facebook.com/rcat/posts/111" })}
        mediaAssets={[]}
      />
    );

    expect(screen.getByText("Facebook")).toBeInTheDocument();
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

  it("keeps managed document rows visually framed while linking directly to fileUrl", () => {
    render(<DocumentListCard items={[createPublicDocumentItem()]} />);

    const documentLink = screen.getByRole("link", { name: /Public file document/ });

    expect(documentLink).toHaveAttribute("href", "https://example.edu/public-file.pdf");
    expect(documentLink).toHaveClass("rcat-card-muted", "rcat-focus-ring", "block");
    expect(within(documentLink).getByText("Policy")).toBeInTheDocument();
  });

  it("supports compact document lists with an accessible view-all CTA", () => {
    render(
      <DocumentListCard
        items={[
          createPublicDocumentItem({ id: "document-1", title: "Document one" }),
          createPublicDocumentItem({ id: "document-2", title: "Document two" }),
          createPublicDocumentItem({ id: "document-3", title: "Document three" }),
          createPublicDocumentItem({ id: "document-4", title: "Document four" })
        ]}
        limit={3}
        viewAllHref="/documents"
        viewAllLabel="ดูเอกสารทั้งหมด"
      />
    );

    expect(screen.getByText("Document one")).toBeInTheDocument();
    expect(screen.getByText("Document two")).toBeInTheDocument();
    expect(screen.getByText("Document three")).toBeInTheDocument();
    expect(screen.queryByText("Document four")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ดูเอกสารเผยแพร่ทั้งหมด" })).toHaveAttribute("href", "/documents");
  });

  it("opens complete event details when a calendar item is clicked", async () => {
    const user = userEvent.setup();
    const events: CalendarEvent[] = [
      {
        id: "event-1",
        title: "Orientation day",
        date: "2099-05-20T09:00:00.000Z",
        endDate: "2099-05-20T11:00:00.000Z",
        audience: "public",
        status: "confirmed",
        location: "Main hall",
        category: "Students",
        description: "Full orientation schedule and preparation details.",
        visibility: "public"
      }
    ];

    render(<EventListCard items={events} />);

    expect(screen.getByText("Orientation day").closest(".rcat-card")).not.toBeNull();
    expect(screen.getByText("Main hall")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ดูรายละเอียด Orientation day" }));

    const dialog = screen.getByRole("dialog", { name: "Orientation day" });
    expect(within(dialog).getByText("Full orientation schedule and preparation details.")).toBeInTheDocument();
    expect(within(dialog).getByText("Main hall")).toBeInTheDocument();
    expect(within(dialog).getByText("public")).toBeInTheDocument();
    expect(within(dialog).getByText("Students")).toBeInTheDocument();
    expect(within(dialog).getByText("กำลังจะมาถึง")).toBeInTheDocument();
  });

  it("does not mount an event image until its dialog is opened", async () => {
    const user = userEvent.setup();
    const eventImage = createMediaAsset({
      id: "event-image",
      name: "Event attachment",
      thumbnailUrl: "https://drive.google.com/file/d/event-thumbnail-source/view",
      previewUrl: "https://drive.google.com/file/d/event-preview-source/view"
    });
    const event: CalendarEvent = {
      id: "event-with-image",
      title: "Event with image",
      date: "2099-05-20T09:00:00.000Z",
      audience: "public",
      status: "confirmed",
      visibility: "public",
      mediaIds: [eventImage.id]
    };

    render(<EventListCard items={[event]} mediaAssets={[eventImage]} />);

    expect(screen.queryByRole("img", { name: "Event attachment" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ดูรายละเอียด Event with image" }));

    expect(await screen.findByRole("img", { name: "Event attachment" })).toHaveAttribute(
      "src",
      "https://drive.google.com/thumbnail?id=event-thumbnail-source&sz=w640"
    );
  });

  it("supports compact event lists with an accessible view-all CTA", () => {
    const events: CalendarEvent[] = [
      {
        id: "event-1",
        title: "Event one",
        date: "2026-05-20T09:00:00.000Z",
        audience: "public",
        status: "confirmed",
        visibility: "public"
      },
      {
        id: "event-2",
        title: "Event two",
        date: "2026-05-21T09:00:00.000Z",
        audience: "public",
        status: "confirmed",
        visibility: "public"
      },
      {
        id: "event-3",
        title: "Event three",
        date: "2026-05-22T09:00:00.000Z",
        audience: "public",
        status: "confirmed",
        visibility: "public"
      },
      {
        id: "event-4",
        title: "Event four",
        date: "2026-05-23T09:00:00.000Z",
        audience: "public",
        status: "confirmed",
        visibility: "public"
      }
    ];

    render(<EventListCard items={events} limit={3} viewAllHref="/calendar" viewAllLabel="ดูกำหนดการทั้งหมด" />);

    expect(screen.getByText("Event one")).toBeInTheDocument();
    expect(screen.getByText("Event two")).toBeInTheDocument();
    expect(screen.getByText("Event three")).toBeInTheDocument();
    expect(screen.queryByText("Event four")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ดูกำหนดการทั้งหมด" })).toHaveAttribute("href", "/calendar");
  });
});
