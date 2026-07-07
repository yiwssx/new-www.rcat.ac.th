function ensureFolders() {
  const mediaFolder = resolveMediaFolder();
  setSetting(SETTING_KEYS.driveFolderId, mediaFolder.getId());

  return {
    driveFolderId: mediaFolder.getId()
  };
}

function resolveMediaFolder() {
  const configuredFolder = getFolderByIdSafe(getSetting(SETTING_KEYS.driveFolderId));

  if (configuredFolder) {
    return configuredFolder;
  }

  const rootName = getSetting(SETTING_KEYS.rootFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.rootFolderName];
  const mediaFolderName =
    getSetting(SETTING_KEYS.mediaFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.mediaFolderName];
  const rootFolder = getOrCreateFolder(rootName);

  return getOrCreateChildFolder(rootFolder, mediaFolderName);
}

function getFolderByIdSafe(folderId) {
  if (!folderId) {
    return null;
  }

  try {
    return DriveApp.getFolderById(folderId);
  } catch (error) {
    console.warn(`Unable to open media folder by id ${folderId}: ${error.message || error}`);
    return null;
  }
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getOrCreateChildFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}
