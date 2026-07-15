import { describe, expect, it } from "vitest";
import { assertPublicEventListSnapshot, isPublicEventListSnapshot } from "./contract";

const validSnapshot = {
  items: [
    {
      id: "event-1",
      title: "กิจกรรมตัวอย่าง",
      date: "2026-07-15T09:00:00.000Z",
      endDate: "2026-07-15T11:00:00.000Z",
      audience: "นักเรียน",
      status: "confirmed",
      visibility: "public",
      mediaIds: ["media-1"],
      updatedAt: "2026-07-01T00:00:00.000Z"
    }
  ],
  media: [
    {
      id: "media-1",
      name: "ภาพกิจกรรม",
      type: "image",
      size: "120 KB",
      owner: "Admin",
      driveUrl: "https://files.example.test/event.jpg",
      previewUrl: "https://files.example.test/event.jpg",
      updatedAt: "2026-07-01T00:00:00.000Z"
    }
  ],
  generatedAt: "2026-07-15T00:00:00.000Z"
};

describe("public event list contract", () => {
  it("accepts an event snapshot with media attachments", () => {
    expect(() => assertPublicEventListSnapshot(validSnapshot)).not.toThrow();

    expect(isPublicEventListSnapshot(validSnapshot)).toBe(true);
  });

  it("rejects a snapshot without the media array", () => {
    const { media: _media, ...snapshotWithoutMedia } = validSnapshot;

    expect(() => assertPublicEventListSnapshot(snapshotWithoutMedia)).toThrow(/media must be an array/i);
  });

  it("rejects snake_case media ids in a public event", () => {
    expect(() =>
      assertPublicEventListSnapshot({
        ...validSnapshot,
        items: [
          {
            ...validSnapshot.items[0],
            media_ids_json: '["media-1"]'
          }
        ]
      })
    ).toThrow(/media_ids_json/i);
  });

  it("rejects non-string event media ids", () => {
    expect(() =>
      assertPublicEventListSnapshot({
        ...validSnapshot,
        items: [
          {
            ...validSnapshot.items[0],
            mediaIds: ["media-1", 123]
          }
        ]
      })
    ).toThrow(/mediaIds must be a string array/i);
  });

  it("rejects invalid media metadata", () => {
    expect(() =>
      assertPublicEventListSnapshot({
        ...validSnapshot,
        media: [
          {
            ...validSnapshot.media[0],
            previewUrl: 123
          }
        ]
      })
    ).toThrow(/media\.previewUrl must be a string/i);
  });
});
