import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ExternalServiceLink, MediaAsset } from "../../../types";
import { ExternalServicesSection } from "./ExternalServicesSection";

const mediaIcon: MediaAsset = {
  id: "media-icon-1",
  name: "Service icon",
  type: "image",
  size: "12 KB",
  owner: "Admin",
  driveUrl: "https://example.edu/service-icon.png",
  thumbnailUrl: "https://example.edu/service-icon-thumbnail.png",
  updatedAt: "2026-08-08T00:00:00.000Z"
};

const services: ExternalServiceLink[] = [
  {
    id: "service-media",
    title: "บริการรูปภาพ",
    description: "ใช้รูปจากคลังสื่อ",
    href: "https://example.edu/media-service",
    tone: "student",
    iconKey: "media:media-icon-1",
    enabled: true,
    order: 1,
    updatedAt: "2026-08-08T00:00:00.000Z"
  },
  {
    id: "service-link",
    title: "บริการค่าเริ่มต้น",
    description: "ใช้ Link icon",
    href: "https://example.edu/link-service",
    tone: "general",
    iconKey: "apps",
    enabled: true,
    order: 2,
    updatedAt: "2026-08-08T00:00:00.000Z"
  }
];

describe("ExternalServicesSection media icons", () => {
  it("renders an uploaded media image and falls back to Link for legacy or unselected icons", () => {
    const { container } = render(<ExternalServicesSection items={services} mediaAssets={[mediaIcon]} />);

    const mediaSlot = container.querySelector('[data-external-service-icon-source="media"]');
    const linkSlot = container.querySelector('[data-external-service-icon-source="link"]');

    expect(mediaSlot).not.toBeNull();
    expect(mediaSlot?.querySelector("img")).toHaveAttribute("src", "https://example.edu/service-icon-thumbnail.png");
    expect(linkSlot).not.toBeNull();
    expect(linkSlot?.querySelector("img")).toBeNull();
  });

  it("falls back to Link when the referenced media image is missing", () => {
    const { container } = render(<ExternalServicesSection items={[services[0]!]} mediaAssets={[]} />);

    expect(container.querySelector('[data-external-service-icon-source="media"]')).toBeNull();
    expect(container.querySelector('[data-external-service-icon-source="link"]')).not.toBeNull();
  });
});
