import { afterEach, describe, expect, it, vi } from "vitest";
import storageSource from "../../apps-script/Storage.gs?raw";

function loadStorageHelpers() {
  const visitorStatsHeaders = [
    "visitorId",
    "firstSeenAt",
    "lastSeenAt",
    "lastPath",
    "lastPathAt",
    "totalViews",
    "dateKeys",
    "monthKeys",
    "yearKeys",
    "updatedAt"
  ];
  const createSheet = (name: string, sheetRows: unknown[][]) => ({
    getName: () => name,
    getLastRow: () => sheetRows.length,
    getLastColumn: () => sheetRows[0]?.length ?? 0,
    setFrozenRows: vi.fn(),
    getDataRange: () => ({
      getValues: () => sheetRows
    }),
    getRange: vi.fn((row: number, column: number, numRows?: number, numColumns?: number) => ({
      getValues: () =>
        sheetRows
          .slice(row - 1, row - 1 + (numRows ?? 1))
          .map((values) => values.slice(column - 1, column - 1 + (numColumns ?? 1))),
      setValue: (value: unknown) => {
        sheetRows[row - 1][column - 1] = value;
      },
      setValues: (values: unknown[][]) => {
        values.forEach((valuesRow, rowIndex) => {
          valuesRow.forEach((value, columnIndex) => {
            sheetRows[row - 1 + rowIndex] = sheetRows[row - 1 + rowIndex] ?? [];
            sheetRows[row - 1 + rowIndex][column - 1 + columnIndex] = value;
          });
        });
      }
    })),
    appendRow: vi.fn((values: unknown[]) => sheetRows.push(values))
  });
  const createScriptExports = new Function(
    "DEFAULT_VISITOR_STATS",
    "SETTING_KEYS",
    "SHEETS",
    "VISITOR_STATS_HEADERS",
    "getSetting",
    "SpreadsheetApp",
    "LockService",
    "invalidatePublicSnapshotCache",
    `${storageSource}
return {
  getSheetSettingValue,
  getVisitorStats,
  incrementSiteView,
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
  const visitorRows: unknown[][] = [visitorStatsHeaders];
  const settingsSheet = createSheet("Settings", rows);
  const visitorStatsSheet = createSheet("VisitorStats", visitorRows);
  const getSpreadsheet = vi.fn(() => ({
    getSheetByName: vi.fn((name: string) => (name === "VisitorStats" ? visitorStatsSheet : settingsSheet)),
    insertSheet: vi.fn((name: string) => (name === "VisitorStats" ? visitorStatsSheet : settingsSheet))
  }));
  const getSetting = vi.fn((key: string) => (key === "spreadsheetId" ? "spreadsheet-id" : ""));
  const spreadsheetApp = {
    openById: getSpreadsheet
  };
  const scriptLock = {
    tryLock: vi.fn(() => true),
    releaseLock: vi.fn()
  };
  const lockService = {
    getScriptLock: vi.fn(() => scriptLock)
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
      settings: "Settings",
      visitorStats: "VisitorStats"
    },
    visitorStatsHeaders,
    getSetting,
    spreadsheetApp,
    lockService,
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
    incrementSiteView: (input?: Record<string, unknown>) => Record<string, unknown>;
    normalizeVisitorStats: (input?: Record<string, unknown>) => Record<string, unknown>;
    updateVisitorStats: (input?: Record<string, unknown>) => Record<string, unknown>;
  };

  return {
    ...exports,
    invalidatePublicSnapshotCache,
    lockService,
    rows,
    scriptLock,
    settingsSheet,
    visitorRows,
    visitorStatsSheet
  };
}

afterEach(() => {
  vi.useRealTimers();
});

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

  it("updates visitor stats enablement only and invalidates public cache", () => {
    const { invalidatePublicSnapshotCache, rows, updateVisitorStats } = loadStorageHelpers();

    const result = updateVisitorStats({
      enabled: false,
      usersToday: "12",
      totalViews: 99.9
    });
    const stored = JSON.parse(String(rows[1][1]));

    expect(result).toMatchObject({
      enabled: false,
      usersToday: 0,
      totalViews: 0
    });
    expect(stored).toMatchObject({
      enabled: false
    });
    expect(stored.usersToday).toBeUndefined();
    expect(stored.totalViews).toBeUndefined();
    expect(String(result.updatedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(invalidatePublicSnapshotCache).toHaveBeenCalledTimes(1);
  });

  it("increments real site views and unique visitor counters without invalidating public cache", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T03:00:00.000Z"));
    const { incrementSiteView, invalidatePublicSnapshotCache, lockService, scriptLock, visitorRows } =
      loadStorageHelpers();

    const result = incrementSiteView({
      visitorId: "rcat_1234567890abcdef",
      path: "/news",
      timestamp: "2026-05-21T03:00:00.000Z",
      referrerOrigin: "https://example.edu",
      pageTitle: "News"
    });

    expect(result).toMatchObject({
      enabled: true,
      usersToday: 1,
      usersYesterday: 0,
      usersThisMonth: 1,
      usersThisYear: 1,
      totalUsers: 1,
      totalViews: 1,
      onlineUsers: 1,
      updatedAt: "2026-05-21T03:00:00.000Z"
    });
    expect(visitorRows).toHaveLength(2);
    expect(lockService.getScriptLock).toHaveBeenCalledTimes(1);
    expect(scriptLock.tryLock).toHaveBeenCalledWith(3000);
    expect(scriptLock.releaseLock).toHaveBeenCalledTimes(1);
    expect(invalidatePublicSnapshotCache).not.toHaveBeenCalled();
  });

  it("throttles duplicate same-path site views while keeping the visitor online", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T03:00:00.000Z"));
    const { incrementSiteView } = loadStorageHelpers();

    incrementSiteView({
      visitorId: "rcat_1234567890abcdef",
      path: "/news"
    });
    vi.setSystemTime(new Date("2026-05-21T03:05:00.000Z"));
    const duplicate = incrementSiteView({
      visitorId: "rcat_1234567890abcdef",
      path: "/news"
    });

    expect(duplicate.totalViews).toBe(1);
    expect(duplicate.totalUsers).toBe(1);
    expect(duplicate.onlineUsers).toBe(1);
    expect(duplicate.updatedAt).toBe("2026-05-21T03:05:00.000Z");
  });

  it("counts different public paths as additional views for the same visitor", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T03:00:00.000Z"));
    const { incrementSiteView } = loadStorageHelpers();

    incrementSiteView({
      visitorId: "rcat_1234567890abcdef",
      path: "/news"
    });
    const nextPath = incrementSiteView({
      visitorId: "rcat_1234567890abcdef",
      path: "/announcements"
    });

    expect(nextPath.totalViews).toBe(2);
    expect(nextPath.totalUsers).toBe(1);
    expect(nextPath.usersToday).toBe(1);
  });

  it("counts active online users within five minutes and ignores older visitors", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T03:10:00.000Z"));
    const { getVisitorStats, visitorRows } = loadStorageHelpers();

    visitorRows.push([
      "rcat_recent123456",
      "2026-05-21T03:06:00.000Z",
      "2026-05-21T03:06:00.000Z",
      "/news",
      "2026-05-21T03:06:00.000Z",
      1,
      "2026-05-21",
      "2026-05",
      "2026",
      "2026-05-21T03:06:00.000Z"
    ]);
    visitorRows.push([
      "rcat_old123456789",
      "2026-05-21T02:00:00.000Z",
      "2026-05-21T02:00:00.000Z",
      "/news",
      "2026-05-21T02:00:00.000Z",
      1,
      "2026-05-21",
      "2026-05",
      "2026",
      "2026-05-21T02:00:00.000Z"
    ]);

    expect(getVisitorStats()).toMatchObject({
      usersToday: 2,
      totalUsers: 2,
      totalViews: 2,
      onlineUsers: 1
    });
  });

  it("rejects invalid site view payloads safely", () => {
    const { incrementSiteView, visitorRows } = loadStorageHelpers();

    expect(() =>
      incrementSiteView({
        visitorId: "contains space",
        path: "/news"
      })
    ).toThrow("Invalid site view payload.");
    expect(() =>
      incrementSiteView({
        visitorId: "rcat_1234567890abcdef",
        path: "/admin"
      })
    ).toThrow("Site view path is not trackable.");
    expect(visitorRows).toHaveLength(1);
  });
});
