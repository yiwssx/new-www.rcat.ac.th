function getMenu() {
  const spreadsheet = getSpreadsheet();
  const rows = readObjects(spreadsheet.getSheetByName(SHEETS.menu), MENU_HEADERS);
  const itemMap = {};
  const rootItems = [];

  rows
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .forEach((row) => {
      itemMap[row.id] = {
        id: row.id,
        label: row.labelTh || "",
        href: row.href || "/",
        enabled: row.enabled === true || row.enabled === "TRUE" || row.enabled === "true",
        children: []
      };
    });

  rows
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .forEach((row) => {
      const item = itemMap[row.id];

      if (!item) {
        return;
      }

      if (row.parentId && itemMap[row.parentId]) {
        itemMap[row.parentId].children.push(item);
        return;
      }

      rootItems.push(item);
    });

  return cleanMenuChildren(rootItems);
}

function cleanMenuChildren(items) {
  return items.map((item) => {
    const nextItem = {
      id: item.id,
      label: item.label,
      href: item.href,
      enabled: item.enabled
    };

    if (item.children && item.children.length) {
      nextItem.children = cleanMenuChildren(item.children);
    }

    return nextItem;
  });
}

function replaceMenu(items) {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.menu);
  const rows = [];

  flattenMenuItems(items, "", rows);

  sheet.clear();
  sheet.getRange(1, 1, 1, MENU_HEADERS.length).setValues([MENU_HEADERS]);
  sheet.setFrozenRows(1);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, MENU_HEADERS.length).setValues(rows);
  }

  return getMenu();
}


function flattenMenuItems(items, parentId, rows) {
  items.forEach((item, index) => {
    validateRequired(item, ["id", "href"]);

    const menuLabel = typeof item.label === "string" ? item.label.trim() : "";

    if (!menuLabel) {
      throw new Error("Each menu item needs a label.");
    }

    rows.push([
      item.id,
      parentId,
      menuLabel,
      item.href,
      index,
      item.enabled === false ? "FALSE" : "TRUE"
    ]);

    if (item.children && item.children.length) {
      flattenMenuItems(item.children, item.id, rows);
    }
  });
}
