function getSpreadsheet() {
  const spreadsheetId = getSetting(SETTING_KEYS.spreadsheetId);

  if (!spreadsheetId) {
    throw new Error("Run setupCmsBackend first so the spreadsheet id can be stored.");
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureSheet(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const maxColumns = Math.max(sheet.getLastColumn(), headers.length);
  const currentHeaders = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, maxColumns).getValues()[0].filter((header) => header)
    : [];

  if (!currentHeaders.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const mergedHeaders = headers.concat(currentHeaders.filter((header) => headers.indexOf(header) === -1));
  const hasHeaders = mergedHeaders.every((header, index) => currentHeaders[index] === header);

  if (!hasHeaders) {
    const existingRows = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, currentHeaders.length).getValues()
      : [];
    const nextRows = existingRows.map((row) =>
      mergedHeaders.map((header) => {
        const sourceIndex = currentHeaders.indexOf(header);
        return sourceIndex === -1 ? "" : row[sourceIndex];
      })
    );

    sheet.getRange(1, 1, 1, mergedHeaders.length).setValues([mergedHeaders]);
    if (nextRows.length) {
      sheet.getRange(2, 1, nextRows.length, mergedHeaders.length).setValues(nextRows);
    }
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function ensureSettingsSheet(spreadsheet) {
  const sheet = ensureSheet(spreadsheet, SHEETS.settings, ["key", "value"]);
  const settings = [
    {
      key: SETTING_KEYS.publicSiteUrl,
      value: getSetting(SETTING_KEYS.publicSiteUrl)
    },
    {
      key: SETTING_KEYS.driveFolderId,
      value: getSetting(SETTING_KEYS.driveFolderId)
    },
    {
      key: SETTING_KEYS.docsFolderId,
      value: getSetting(SETTING_KEYS.docsFolderId)
    },
    {
      key: SETTING_KEYS.spreadsheetName,
      value: getSetting(SETTING_KEYS.spreadsheetName)
    },
    {
      key: SETTING_KEYS.rootFolderName,
      value: getSetting(SETTING_KEYS.rootFolderName)
    },
    {
      key: SETTING_KEYS.mediaFolderName,
      value: getSetting(SETTING_KEYS.mediaFolderName)
    },
    {
      key: SETTING_KEYS.docsFolderName,
      value: getSetting(SETTING_KEYS.docsFolderName)
    },
    {
      key: SETTING_KEYS.authSessionHours,
      value: getSetting(SETTING_KEYS.authSessionHours)
    },
    {
      key: SETTING_KEYS.dateDisplayFormat,
      value: getSetting(SETTING_KEYS.dateDisplayFormat)
    },
    {
      key: SETTING_KEYS.timeDisplayMode,
      value: getSetting(SETTING_KEYS.timeDisplayMode)
    }
  ];

  settings.forEach((setting) => upsertSetting(sheet, setting.key, setting.value));
  upsertSettingIfMissing(sheet, SETTING_KEYS.siteSettings, JSON.stringify(DEFAULT_SITE_SETTINGS));
  return sheet;
}

function getOrEnsureSettingsSheet(spreadsheet) {
  return spreadsheet.getSheetByName(SHEETS.settings) || ensureSettingsSheet(spreadsheet);
}

function upsertSetting(sheet, key, value) {
  const rows = sheet.getDataRange().getValues();

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index][0] === key) {
      sheet.getRange(index + 1, 2).setValue(value);
      return;
    }
  }

  sheet.appendRow([key, value]);
}

function upsertSettingIfMissing(sheet, key, value) {
  const rows = sheet.getDataRange().getValues();

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index][0] === key) {
      return;
    }
  }

  sheet.appendRow([key, value]);
}

function getSheetSettingValue(sheet, key) {
  if (!sheet || !key || sheet.getLastRow() < 2) {
    return "";
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();

  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0] || "") === String(key)) {
      return normalizeCell(values[index][1]);
    }
  }

  return "";
}

function normalizeTimeDisplayMode(value) {
  return value === "12h" ? "12h" : "24h";
}

function normalizeDateDisplayFormat(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.dateDisplayFormat];
  }

  if (normalized.length > 80 || /[^A-Za-z0-9 :/.,_\-\[\]\\]/.test(normalized)) {
    return DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.dateDisplayFormat];
  }

  return normalized;
}

function getDisplaySettings() {
  return {
    dateFormat: normalizeDateDisplayFormat(
      getSetting(SETTING_KEYS.dateDisplayFormat) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.dateDisplayFormat]
    ),
    timeMode: normalizeTimeDisplayMode(
      getSetting(SETTING_KEYS.timeDisplayMode) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.timeDisplayMode]
    )
  };
}

function updateDisplaySettings(input) {
  const settings = getDisplaySettings();
  const dateFormat = normalizeDateDisplayFormat(
    input && input.dateFormat !== undefined ? input.dateFormat : settings.dateFormat
  );
  const timeMode = normalizeTimeDisplayMode(
    input && input.timeMode !== undefined ? input.timeMode : settings.timeMode
  );

  setSetting(SETTING_KEYS.dateDisplayFormat, dateFormat);
  setSetting(SETTING_KEYS.timeDisplayMode, timeMode);
  ensureSettingsSheet(getSpreadsheet());

  const updatedSettings = getDisplaySettings();
  invalidatePublicSnapshotCache();
  return updatedSettings;
}

function ensureFolders() {
  const rootName = getSetting(SETTING_KEYS.rootFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.rootFolderName];
  const mediaFolderName = getSetting(SETTING_KEYS.mediaFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.mediaFolderName];
  const docsFolderName = getSetting(SETTING_KEYS.docsFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.docsFolderName];
  const rootFolder = getOrCreateFolder(rootName);
  const driveFolderId = getSetting(SETTING_KEYS.driveFolderId);
  const docsFolderId = getSetting(SETTING_KEYS.docsFolderId);
  const mediaFolder = resolveManagedFolder({
    rootFolder,
    folderId: driveFolderId,
    folderName: mediaFolderName
  });
  const docsFolder = resolveManagedFolder({
    rootFolder,
    folderId: docsFolderId,
    folderName: docsFolderName
  });

  setSetting(SETTING_KEYS.driveFolderId, mediaFolder.getId());
  setSetting(SETTING_KEYS.docsFolderId, docsFolder.getId());

  return {
    driveFolderId: mediaFolder.getId(),
    docsFolderId: docsFolder.getId()
  };
}

function resolveManagedFolder(input) {
  const existingFolder = input.folderId ? getFolderByIdSafe(input.folderId) : null;

  if (
    existingFolder &&
    existingFolder.getName() === input.folderName &&
    isFolderInsideParent(existingFolder, input.rootFolder.getId())
  ) {
    return existingFolder;
  }

  return getOrCreateChildFolder(input.rootFolder, input.folderName);
}

function getFolderByIdSafe(folderId) {
  if (!folderId) {
    return null;
  }

  try {
    return DriveApp.getFolderById(folderId);
  } catch (error) {
    console.warn(`Unable to open folder by id ${folderId}: ${error.message || error}`);
    return null;
  }
}

function isFolderInsideParent(folder, parentId) {
  if (!folder || !parentId) {
    return false;
  }

  const parents = folder.getParents();

  while (parents.hasNext()) {
    if (parents.next().getId() === parentId) {
      return true;
    }
  }

  return false;
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getOrCreateChildFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function readObjects(sheet, headers) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const activeHeaders = getActiveHeaders(sheet, headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, activeHeaders.length).getValues();

  return values
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) =>
      headers.reduce((record, header) => {
        const sourceIndex = activeHeaders.indexOf(header);
        record[header] = sourceIndex === -1 ? "" : normalizeCell(row[sourceIndex]);
        return record;
      }, {})
    );
}

function getActiveHeaders(sheet, expectedHeaders) {
  const maxColumns = Math.max(sheet.getLastColumn(), expectedHeaders.length);
  const activeHeaders = sheet.getRange(1, 1, 1, maxColumns).getValues()[0];

  expectedHeaders.forEach((header) => {
    if (activeHeaders.indexOf(header) === -1) {
      activeHeaders.push(header);
    }
  });

  return activeHeaders.filter((header) => header);
}

function normalizeCell(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function upsertRow(sheet, headers, item) {
  ensureSheet(getSpreadsheet(), sheet.getName(), headers);
  const rows = sheet.getDataRange().getValues();
  const activeHeaders = getActiveHeaders(sheet, headers);
  const idIndex = activeHeaders.indexOf("id");
  const targetRow = rows.findIndex((row, index) => index > 0 && row[idIndex] === item.id);
  const values = activeHeaders.map((header) => {
    const value = item[header];
    return value === undefined || value === null ? "" : value;
  });

  if (targetRow === -1) {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, activeHeaders.length).setValues([values]);
    return;
  }

  sheet.getRange(targetRow + 1, 1, 1, activeHeaders.length).setValues([values]);
}

function findRowById(sheet, headers, id) {
  if (!sheet || !id || sheet.getLastRow() < 2) {
    return null;
  }

  const activeHeaders = getActiveHeaders(sheet, headers);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, activeHeaders.length).getValues();
  const idIndex = activeHeaders.indexOf("id");
  const targetRow = rows.find((row) => row[idIndex] === id);

  if (!targetRow) {
    return null;
  }

  return headers.reduce((record, header) => {
    const sourceIndex = activeHeaders.indexOf(header);
    record[header] = sourceIndex === -1 ? "" : normalizeCell(targetRow[sourceIndex]);
    return record;
  }, {});
}

function deleteRowById(sheetName, headers, id) {
  if (!id) {
    throw new Error("Missing record id.");
  }

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  const rows = sheet.getDataRange().getValues();
  const activeHeaders = getActiveHeaders(sheet, headers);
  const idIndex = activeHeaders.indexOf("id");
  const targetRow = rows.findIndex((row, index) => index > 0 && row[idIndex] === id);

  if (targetRow === -1) {
    throw new Error(`Record not found: ${id}`);
  }

  sheet.deleteRow(targetRow + 1);
}

function buildMetrics(content, media) {
  const publishedCount = content.filter((item) => item.status === "published").length;
  const reviewCount = content.filter((item) => item.status === "review").length;
  const scheduledCount = content.filter((item) => item.status === "scheduled").length;
  const blogCount = content.filter((item) => item.type === "blog").length;

  return [
    {
      id: "published-pages",
      label: "เนื้อหาที่เผยแพร่",
      value: String(publishedCount),
      trend: `ตั้งเวลา ${scheduledCount} รายการ / บทความ ${blogCount} รายการ`,
      tone: "blue"
    },
    {
      id: "review-queue",
      label: "คิวรอตรวจสอบ",
      value: String(reviewCount),
      trend: "รอบบรรณาธิการตรวจสอบ",
      tone: "amber"
    },
    {
      id: "media-assets",
      label: "สื่อใน Drive",
      value: String(media.length),
      trend: "ซิงก์จากชีตสื่อ",
      tone: "green"
    },
    {
      id: "sync-health",
      label: "สถานะซิงก์",
      value: "100%",
      trend: "Apps Script ออนไลน์",
      tone: "red"
    }
  ];
}

