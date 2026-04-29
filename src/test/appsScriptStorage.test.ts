import { describe, expect, it, vi } from "vitest";
import storageSource from "../../apps-script/Storage.gs?raw";

function loadStorageHelpers() {
  const createScriptExports = new Function(
    `${storageSource}
return {
  getSheetSettingValue
};`
  );

  return createScriptExports() as {
    getSheetSettingValue: (sheet: {
      getLastRow: () => number;
      getRange: (row: number, column: number, numRows: number, numColumns: number) => {
        getValues: () => unknown[][];
      };
    } | null, key: string) => unknown;
  };
}

describe("Apps Script Storage helpers", () => {
  it("reads a settings value from the key/value rows", () => {
    const { getSheetSettingValue } = loadStorageHelpers();
    const getValues = vi.fn(() => [
      ["publicSiteUrl", "https://example.edu"],
      ["siteSettings", "{\"siteName\":\"School\"}"]
    ]);
    const getRange = vi.fn(() => ({ getValues }));

    const result = getSheetSettingValue(
      {
        getLastRow: () => 3,
        getRange
      },
      "siteSettings"
    );

    expect(result).toBe("{\"siteName\":\"School\"}");
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
});
