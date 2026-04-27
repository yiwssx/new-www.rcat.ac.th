function getSetting(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || "";
}

function setSetting(key, value) {
  const nextValue = value === undefined || value === null ? "" : String(value);
  PropertiesService.getScriptProperties().setProperty(key, nextValue);
  return nextValue;
}
