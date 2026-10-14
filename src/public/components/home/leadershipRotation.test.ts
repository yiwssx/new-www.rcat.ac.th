import { describe, expect, it } from "vitest";
import {
  defaultSiteSettings,
  normalizeLeadershipSettings,
  normalizeSiteSettings
} from "../../../services/siteSettings";
import { getHomepageLeadershipPortraits, getLoopedLeadershipIndex } from "./leadershipRotation";

describe("homepage leadership rotation model", () => {
  it("retains the legacy director as first slot and includes deputies strictly in canonical order", () => {
    const settings = normalizeSiteSettings({
      directorName: "Director",
      directorTitle: "Principal",
      directorDescription: "Director bio",
      directorImageUrl: "https://images.example.test/director.jpg",
      leadership: {
        autoplayIntervalSeconds: 6,
        deputies: [
          { enabled: true, name: "Deputy A", title: "Deputy 1", description: "A", imageUrl: "" },
          { enabled: true, name: "Deputy B", title: "Deputy 2", description: "B", imageUrl: "" },
          { enabled: false, name: "Deputy C", title: "Deputy 3", description: "C", imageUrl: "" },
          { enabled: true, name: "Deputy D", title: "Deputy 4", description: "D", imageUrl: "" }
        ]
      }
    });
    expect(getHomepageLeadershipPortraits(settings).map((p) => [p.slot, p.name])).toEqual([
      [0, "Director"],
      [1, "Deputy A"],
      [2, "Deputy B"],
      [4, "Deputy D"]
    ]);
    expect(getLoopedLeadershipIndex(4, 4)).toBe(0);
    expect(getLoopedLeadershipIndex(-1, 4)).toBe(3);
    expect(getLoopedLeadershipIndex(1, 0)).toBe(0);
  });

  it("keeps the original director-only view when no roster is configured", () => {
    expect(getHomepageLeadershipPortraits({ ...defaultSiteSettings, directorName: "Existing Director" })).toEqual([
      { slot: 0, name: "Existing Director", title: "", description: "", imageUrl: "" }
    ]);
    expect(getHomepageLeadershipPortraits(defaultSiteSettings)).toEqual([]);
  });

  it("normalizes malformed deputy entries without making up names or shifting slots", () => {
    const normalized = normalizeLeadershipSettings({
      autoplayIntervalSeconds: 9999,
      deputies: [
        { enabled: true, name: "  Person A  ", title: "Deputy", imageUrl: "javascript:alert(1)" },
        { enabled: true, name: "", title: "Deputy 2", imageUrl: "" },
        null,
        { enabled: true, name: "D", title: "Deputy 4", imageUrl: "https://images.example.test/d.jpg" },
        { enabled: true, name: "EXTRA", title: "Invalid slot" }
      ]
    });
    expect(normalized.autoplayIntervalSeconds).toBe(30);
    expect(normalized.deputies).toHaveLength(4);
    expect(normalized.deputies[0].name).toBe("Person A");
    expect(normalized.deputies[0].imageUrl).toBe("");
    expect(normalized.deputies[2].enabled).toBe(false);
    expect(
      getHomepageLeadershipPortraits({
        ...defaultSiteSettings,
        leadership: normalized
      }).map((p) => p.name)
    ).toEqual(["Person A", "D"]);
    expect(normalizeLeadershipSettings(null).autoplayIntervalSeconds).toBe(6);
  });
});
