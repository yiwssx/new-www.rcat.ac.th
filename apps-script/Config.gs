const SETTING_KEYS = {
  driveFolderId: "driveFolderId",
  rootFolderName: "rootFolderName",
  mediaFolderName: "mediaFolderName",
  appsScriptBridgeToken: "APPS_SCRIPT_BRIDGE_TOKEN",
  mediaBridgeToken: "MEDIA_BRIDGE_TOKEN"
};

const DEFAULT_SCRIPT_PROPERTIES = {
  [SETTING_KEYS.rootFolderName]: "RCAT_BACKEND_DATABASE",
  [SETTING_KEYS.mediaFolderName]: "RCAT_MEDIA_STUFF"
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MEDIA_UPLOAD_CHUNK_BYTES = 6 * 256 * 1024;

const ALLOWED_MEDIA_TYPES = ["image", "document", "sheet", "video"];

const ALLOWED_EXACT_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
  "application/csv"
];

const ALLOWED_PUBLIC_MEDIA_EMBED_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be"
];

function ensureDefaultScriptProperties() {
  const scriptProperties = PropertiesService.getScriptProperties();

  Object.keys(DEFAULT_SCRIPT_PROPERTIES).forEach((key) => {
    if (scriptProperties.getProperty(key) === null) {
      scriptProperties.setProperty(key, DEFAULT_SCRIPT_PROPERTIES[key]);
    }
  });
}
