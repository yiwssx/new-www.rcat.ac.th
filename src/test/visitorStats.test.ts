import { describe, expect, it } from "vitest";
import { DEFAULT_VISITOR_STATS, normalizeVisitorStats } from "../services/visitorStats";

describe("visitorStats", () => {
  it("returns disabled zero defaults when input is undefined", () => {
    expect(normalizeVisitorStats()).toEqual(DEFAULT_VISITOR_STATS);
  });

  it("clamps invalid and negative numbers", () => {
    const stats = normalizeVisitorStats({
      enabled: true,
      usersToday: -4,
      usersYesterday: 12.9,
      usersThisMonth: Number.NaN,
      usersThisYear: "20" as unknown as number,
      totalUsers: -1,
      totalViews: 100.7,
      onlineUsers: "invalid" as unknown as number
    });

    expect(stats).toMatchObject({
      enabled: true,
      usersToday: 0,
      usersYesterday: 12,
      usersThisMonth: 0,
      usersThisYear: 20,
      totalUsers: 0,
      totalViews: 100,
      onlineUsers: 0
    });
  });
});
