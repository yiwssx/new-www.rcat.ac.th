import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContentBlocksRenderer from "../shared/components/ContentBlocksRenderer";
import { resetNearViewportObserversForTests } from "../shared/media/nearViewport";

afterEach(() => {
  resetNearViewportObserversForTests();
  vi.unstubAllGlobals();
});

describe("ContentBlocksRenderer", () => {
  beforeEach(() => {
    document.getElementById("facebook-jssdk")?.remove();
  });

  it("does not render invalid Facebook post URLs", () => {
    const { container } = render(
      <ContentBlocksRenderer
        mediaAssets={[]}
        blocks={[
          {
            id: "facebook-1",
            type: "facebookPost",
            href: "https://example.com/post",
            caption: "Should not render",
            showText: true,
            width: 500
          }
        ]}
      />
    );

    expect(container.querySelector(".fb-post")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Facebook post")).not.toBeInTheDocument();
    expect(screen.queryByText("Should not render")).not.toBeInTheDocument();
  });

  it("renders Facebook post iframe plugin markup for valid URLs", () => {
    const { container } = render(
      <ContentBlocksRenderer
        mediaAssets={[]}
        blocks={[
          {
            id: "facebook-1",
            type: "facebookPost",
            href: "https://www.facebook.com/rcat/posts/12345",
            caption: "Official Facebook post",
            showText: true,
            width: 900
          }
        ]}
      />
    );

    const iframe = screen.getByTitle("Facebook post");
    const iframeSrc = iframe.getAttribute("src") || "";
    const pluginUrl = new URL(iframeSrc);

    expect(container.querySelector(".fb-post")).not.toBeInTheDocument();
    expect(pluginUrl.origin + pluginUrl.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(iframeSrc).toContain("href=https%3A%2F%2Fwww.facebook.com%2Frcat%2Fposts%2F12345");
    expect(pluginUrl.searchParams.get("href")).toBe("https://www.facebook.com/rcat/posts/12345");
    expect(pluginUrl.searchParams.get("show_text")).toBe("true");
    expect(pluginUrl.searchParams.get("width")).toBe("750");
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe).toHaveAttribute("scrolling", "no");
    expect(iframe).toHaveAttribute("width", "750");
    expect(iframe).toHaveAttribute("height", "761");
    expect(screen.getByText("Official Facebook post")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดโพสต์บน Facebook" })).toHaveAttribute(
      "href",
      "https://www.facebook.com/rcat/posts/12345"
    );
    expect(document.getElementById("facebook-jssdk")).not.toBeInTheDocument();
  });

  it("renders custom labels for external links and media-library attachments", () => {
    render(
      <ContentBlocksRenderer
        mediaAssets={[
          {
            id: "attachment-document",
            name: "original-file-name.pdf",
            type: "document",
            size: "2 MB",
            owner: "Public",
            driveUrl: "https://drive.google.com/file/d/attachment-document/view",
            updatedAt: "2026-08-09T00:00:00.000Z"
          }
        ]}
        blocks={[
          {
            id: "external-link",
            type: "link",
            source: "external",
            label: "อ่านข้อมูลจากหน่วยงานต้นทาง",
            href: "https://example.org/source",
            mediaId: ""
          },
          {
            id: "media-link",
            type: "link",
            source: "media",
            label: "ดาวน์โหลดแบบฟอร์มสมัครเรียน",
            href: "",
            mediaId: "attachment-document"
          }
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "อ่านข้อมูลจากหน่วยงานต้นทาง" })).toHaveAttribute(
      "href",
      "https://example.org/source"
    );
    expect(screen.getByRole("link", { name: "ดาวน์โหลดแบบฟอร์มสมัครเรียน" })).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/attachment-document/view"
    );
    expect(screen.queryByText("original-file-name.pdf")).not.toBeInTheDocument();
  });

  it("falls back to the media filename or external URL when no custom link label is set", () => {
    render(
      <ContentBlocksRenderer
        mediaAssets={[
          {
            id: "attachment-document",
            name: "คู่มือการสมัคร.pdf",
            type: "document",
            size: "2 MB",
            owner: "Public",
            driveUrl: "https://drive.google.com/file/d/attachment-document/view",
            updatedAt: "2026-08-09T00:00:00.000Z"
          }
        ]}
        blocks={[
          {
            id: "external-link",
            type: "link",
            source: "external",
            label: "",
            href: "https://example.org/source",
            mediaId: ""
          },
          {
            id: "media-link",
            type: "link",
            source: "media",
            label: "",
            href: "",
            mediaId: "attachment-document"
          }
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "https://example.org/source" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "คู่มือการสมัคร.pdf" })).toBeInTheDocument();
  });

  it("renders semantic body images immediately while deferring video network sources until near viewport", async () => {
    const observers: Array<{
      callback: IntersectionObserverCallback;
      target?: Element;
    }> = [];

    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(
        class {
          readonly disconnect = vi.fn();
          readonly root = null;
          readonly rootMargin = "0px";
          readonly thresholds: number[] = [];
          readonly takeRecords = () => [];
          readonly unobserve = vi.fn();
          readonly observe: (target: Element) => void;

          constructor(callback: IntersectionObserverCallback) {
            const record: (typeof observers)[number] = { callback };
            observers.push(record);
            this.observe = vi.fn((target: Element) => {
              record.target = target;
            });
          }
        }
      )
    );

    const { container } = render(
      <ContentBlocksRenderer
        mediaAssets={[
          {
            id: "body-image",
            name: "Body image",
            type: "image",
            size: "100 KB",
            owner: "Public",
            driveUrl: "https://drive.google.com/file/d/body-drive-source/view",
            thumbnailUrl: "https://drive.google.com/file/d/body-thumbnail-source/view",
            previewUrl: "https://drive.google.com/file/d/body-preview-source/view",
            updatedAt: "2026-07-28T00:00:00.000Z"
          },
          {
            id: "body-video",
            name: "Body video",
            type: "video",
            size: "1 MB",
            owner: "Public",
            driveUrl: "https://www.youtube.com/watch?v=body-video",
            embedUrl: "https://www.youtube.com/embed/body-video",
            updatedAt: "2026-07-28T00:00:00.000Z"
          }
        ]}
        blocks={[
          { id: "image-block", type: "image", mediaId: "body-image", caption: "Body image caption" },
          { id: "video-block", type: "video", mediaId: "body-video", caption: "Body video caption" }
        ]}
      />
    );

    expect(screen.getByRole("img", { name: "Body image caption" })).toHaveAttribute(
      "src",
      "https://drive.google.com/thumbnail?id=body-preview-source&sz=w1200"
    );
    expect(screen.getByRole("img", { name: "Body image caption" })).toHaveAttribute("loading", "lazy");
    expect(screen.queryByTitle("Body video")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-public-image-placeholder="true"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-public-embed-placeholder="true"]')).toHaveLength(1);
    expect(observers).toHaveLength(1);

    act(() => {
      observers[0].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 1,
            target: observers[0].target
          } as IntersectionObserverEntry
        ],
        {} as IntersectionObserver
      );
    });

    expect(await screen.findByTitle("Body video")).toHaveAttribute("src", "https://www.youtube.com/embed/body-video");
  });
});
