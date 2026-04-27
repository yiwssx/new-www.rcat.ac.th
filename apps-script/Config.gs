const SETTING_KEYS = {
  spreadsheetId: "spreadsheetId",
  spreadsheetName: "spreadsheetName",
  driveFolderId: "driveFolderId",
  docsFolderId: "docsFolderId",
  publicSiteUrl: "publicSiteUrl",
  rootFolderName: "rootFolderName",
  mediaFolderName: "mediaFolderName",
  docsFolderName: "docsFolderName",
  defaultAdminName: "defaultAdminName",
  defaultAdminEmail: "defaultAdminEmail",
  defaultAdminPasswordHash: "defaultAdminPasswordHash",
  authTokenSecret: "authTokenSecret",
  authSessionHours: "authSessionHours"
};

const DEFAULT_SCRIPT_PROPERTIES = {
  [SETTING_KEYS.spreadsheetName]: "RCAT_DATABASE",
  [SETTING_KEYS.publicSiteUrl]: "",
  [SETTING_KEYS.rootFolderName]: "RCAT_BACKEND_DATABASE",
  [SETTING_KEYS.mediaFolderName]: "RCAT_MEDIA_STUFF",
  [SETTING_KEYS.docsFolderName]: "RCAT_CONTENTS",
  [SETTING_KEYS.defaultAdminName]: "Administrator",
  [SETTING_KEYS.defaultAdminEmail]: "",
  [SETTING_KEYS.defaultAdminPasswordHash]: "",
  [SETTING_KEYS.authSessionHours]: "8"
};

const SHEETS = {
  content: "Content",
  media: "Media",
  events: "Events",
  menu: "Menu",
  users: "Users",
  language: "LanguageSource",
  settings: "Settings"
};

const CONTENT_HEADERS = [
  "id",
  "title",
  "slug",
  "type",
  "status",
  "owner",
  "summary",
  "category",
  "tags",
  "seoTitle",
  "seoDescription",
  "canonicalUrl",
  "featured",
  "readingMinutes",
  "template",
  "body",
  "bodyDocId",
  "bodyDocUrl",
  "featuredMediaId",
  "mediaIds",
  "updatedAt",
  "publishAt"
];

const MEDIA_HEADERS = [
  "id",
  "name",
  "type",
  "size",
  "owner",
  "driveUrl",
  "fileId",
  "mimeType",
  "previewUrl",
  "embedUrl",
  "updatedAt"
];

const EVENT_HEADERS = [
  "id",
  "title",
  "date",
  "endDate",
  "audience",
  "status",
  "location",
  "description",
  "category",
  "visibility",
  "updatedAt"
];

const MENU_HEADERS = ["id", "parentId", "labelTh", "labelEn", "href", "order", "enabled"];

const USER_HEADERS = [
  "id",
  "name",
  "email",
  "role",
  "status",
  "passwordHash",
  "avatarUrl",
  "createdAt",
  "updatedAt"
];

const LANGUAGE_HEADERS = ["key", "th", "en", "updatedAt"];

function ensureDefaultScriptProperties() {
  const scriptProperties = PropertiesService.getScriptProperties();

  Object.keys(DEFAULT_SCRIPT_PROPERTIES).forEach((key) => {
    if (scriptProperties.getProperty(key) === null) {
      scriptProperties.setProperty(key, DEFAULT_SCRIPT_PROPERTIES[key]);
    }
  });
}
