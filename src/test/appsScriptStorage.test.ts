import { describe, expect, it, vi } from "vitest";
import storageSource from "../../apps-script/Storage.gs?raw";

function loadStorageHelpers() {
  const createScriptExports = new Function(
    "DEFAULT_VISITOR_STATS",
    "SETTING_KEYS",
    "SHEETS",
    "getSetting",
    "SpreadsheetApp",
    "invalidatePublicSnapshotCache",
    `${storageSource}
return {
  getSheetSettingValue,
  getVisitorStats,
  normalizeVisitorStats,
  updateVisitorStats
};`
  );

  const rows: unknown[][] = [
    ["key", "value"],
    [
      "visitorStats",
      JSON.stringify({
        enabled: true,
        usersToday: 9,
        usersYesterday: 8,
        usersThisMonth: 7,
        usersThisYear: 6,
        totalUsers: 5,
        totalViews: 4,
        onlineUsers: 3,
        updatedAt: "2026-05-10T00:00:00.000Z"
      })
    ]
  ];
  const settingsSheet = {
    getLastRow: () => rows.length,
    getDataRange: () => ({
      getValues: () => rows
    }),
    getRange: vi.fn((row: number, column: number, numRows?: number, numColumns?: number) => ({
      getValues: () =>
        rows
          .slice(row - 1, row - 1 + (numRows ?? 1))
          .map((values) => values.slice(column - 1, column - 1 + (numColumns ?? 1))),
      setValue: (value: unknown) => {
        rows[row - 1][column - 1] = value;
      }
    })),
    appendRow: vi.fn((values: unknown[]) => rows.push(values))
  };
  const getSpreadsheet = vi.fn(() => ({
    getSheetByName: vi.fn(() => settingsSheet)
  }));
  const getSetting = vi.fn((key: string) => (key === "spreadsheetId" ? "spreadsheet-id" : ""));
  const spreadsheetApp = {
    openById: getSpreadsheet
  };
  const invalidatePublicSnapshotCache = vi.fn();
  const exports = createScriptExports(
    {
      enabled: false,
      usersToday: 0,
      usersYesterday: 0,
      usersThisMonth: 0,
      usersThisYear: 0,
      totalUsers: 0,
      totalViews: 0,
      onlineUsers: 0,
      updatedAt: ""
    },
    {
      spreadsheetId: "spreadsheetId",
      visitorStats: "visitorStats"
    },
    {
      settings: "Settings"
    },
    getSetting,
    spreadsheetApp,
    invalidatePublicSnapshotCache
  ) as {
    getSheetSettingValue: (
      sheet: {
        getLastRow: () => number;
        getRange: (
          row: number,
          column: number,
          numRows: number,
          numColumns: number
        ) => {
          getValues: () => unknown[][];
        };
      } | null,
      key: string
    ) => unknown;
    getVisitorStats: () => Record<string, unknown>;
    normalizeVisitorStats: (input?: Record<string, unknown>) => Record<string, unknown>;
    updateVisitorStats: (input?: Record<string, unknown>) => Record<string, unknown>;
  };

  return {
    ...exports,
    invalidatePublicSnapshotCache,
    rows,
    settingsSheet
  };
}

describe("Apps Script Storage helpers", () => {
  it("reads a settings value from the key/value rows", () => {
    const { getSheetSettingValue } = loadStorageHelpers();
    const getValues = vi.fn(() => [
      ["publicSiteUrl", "https://example.edu"],
      ["siteSettings", '{"siteName":"School"}']
    ]);
    const getRange = vi.fn(() => ({ getValues }));

    const result = getSheetSettingValue(
      {
        getLastRow: () => 3,
        getRange
      },
      "siteSettings"
    );

    expect(result).toBe('{"siteName":"School"}');
    expect(getRange).toHaveBeenCalledWith(2, 1, 2, 2);
  });

  it("returns an empty string when the settings sheet or key is unavailable", () => {
    const { getSheetSettingValue } = loadStorageHelpers();

    expect(getSheetSettingValue(null, "siteSettings")).toBe("");
    expect(
      getSheetSettingValue(
        {
          getLastRow: () => 1,
          getRange: vi.fn()
        },
        "siteSettings"
      )
    ).toBe("");
  });

  it("returns default visitor stats when input is missing or invalid", () => {
    const { normalizeVisitorStats } = loadStorageHelpers();

    expect(normalizeVisitorStats()).toEqual({
      enabled: false,
      usersToday: 0,
      usersYesterday: 0,
      usersThisMonth: 0,
      usersThisYear: 0,
      totalUsers: 0,
      totalViews: 0,
      onlineUsers: 0,
      updatedAt: ""
    });
    expect(
      normalizeVisitorStats({
        enabled: true,
        usersToday: -1,
        usersYesterday: 2.8,
        usersThisMonth: "bad",
        totalViews: "10"
      })
    ).toMatchObject({
      enabled: true,
      usersToday: 0,
      usersYesterday: 2,
      usersThisMonth: 0,
      totalViews: 10
    });
  });

  it("updates visitor stats, stores normalized JSON, and invalidates public cache", () => {
    const { invalidatePublicSnapshotCache, rows, updateVisitorStats } = loadStorageHelpers();

    const result = updateVisitorStats({
      enabled: true,
      usersToday: "12",
      usersYesterday: -3,
      totalViews: 99.9,
      onlineUsers: 4
    });
    const stored = JSON.parse(String(rows[1][1]));

    expect(result).toMatchObject({
      enabled: true,
      usersToday: 12,
      usersYesterday: 0,
      totalViews: 99,
      onlineUsers: 4
    });
    expect(stored).toMatchObject(result);
    expect(String(result.updatedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(invalidatePublicSnapshotCache).toHaveBeenCalledTimes(1);
  });
});
