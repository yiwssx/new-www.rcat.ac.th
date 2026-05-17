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
  authSessionHours: "authSessionHours",
  dateDisplayFormat: "dateDisplayFormat",
  timeDisplayMode: "timeDisplayMode",
  siteSettings: "siteSettings",
  homepageSettings: "homepageSettings",
  visitorStats: "visitorStats"
};

const DEFAULT_HOMEPAGE_SETTINGS = {
  carousel: {
    autoplayEnabled: true,
    autoplayIntervalSeconds: 5
  },
  introGate: {
    enabled: false,
    imageUrl: "",
    imageAlt: "ภาพแนะนำ",
    primaryButtonLabel: "เข้าสู่เว็บไซต์หลัก",
    secondaryButtonLabel: "",
    secondaryButtonUrl: "",
    storageKey: "public-intro-gate"
  },
  marquee: {
    enabled: false,
    label: "ประชาสัมพันธ์",
    text: "",
    speedSeconds: 32
  },
  introVideo: {
    enabled: false,
    title: "วีดิทัศน์แนะนำสถานศึกษา",
    youtubeEmbedUrl: ""
  }
};

const DEFAULT_VISITOR_STATS = {
  enabled: false,
  usersToday: 0,
  usersYesterday: 0,
  usersThisMonth: 0,
  usersThisYear: 0,
  totalUsers: 0,
  totalViews: 0,
  onlineUsers: 0,
  updatedAt: ""
};

const DEFAULT_SCRIPT_PROPERTIES = {
  [SETTING_KEYS.spreadsheetName]: "RCAT_DATABASE",
  [SETTING_KEYS.publicSiteUrl]: "",
  [SETTING_KEYS.rootFolderName]: "RCAT_BACKEND_DATABASE",
  [SETTING_KEYS.mediaFolderName]: "RCAT_MEDIA_STUFF",
  [SETTING_KEYS.docsFolderName]: "RCAT_CONTENTS",
  [SETTING_KEYS.defaultAdminName]: "ผู้ดูแลระบบ",
  [SETTING_KEYS.defaultAdminEmail]: "",
  [SETTING_KEYS.defaultAdminPasswordHash]: "",
  [SETTING_KEYS.authSessionHours]: "8",
  [SETTING_KEYS.dateDisplayFormat]: "j F Y",
  [SETTING_KEYS.timeDisplayMode]: "24h"
};

const SHEETS = {
  content: "Content",
  carousel: "Carousel",
  externalServices: "ExternalServices",
  media: "Media",
  events: "Events",
  menu: "Menu",
  users: "Users",
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
  "publishAt",
  "viewCount",
  "lastViewedAt"
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

const CAROUSEL_HEADERS = [
  "id",
  "title",
  "subtitle",
  "chip",
  "imageUrl",
  "imageAlt",
  "buttonLabel",
  "href",
  "enabled",
  "order",
  "startAt",
  "endAt",
  "updatedAt"
];

const EXTERNAL_SERVICE_HEADERS = [
  "id",
  "title",
  "description",
  "href",
  "tone",
  "iconKey",
  "enabled",
  "order",
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

const MENU_HEADERS = ["id", "parentId", "labelTh", "href", "order", "enabled"];

const USER_HEADERS = ["id", "name", "email", "role", "status", "passwordHash", "avatarUrl", "createdAt", "updatedAt"];

function ensureDefaultScriptProperties() {
  const scriptProperties = PropertiesService.getScriptProperties();

  Object.keys(DEFAULT_SCRIPT_PROPERTIES).forEach((key) => {
    if (scriptProperties.getProperty(key) === null) {
      scriptProperties.setProperty(key, DEFAULT_SCRIPT_PROPERTIES[key]);
    }
  });
}
