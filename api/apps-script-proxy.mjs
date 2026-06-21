import { handleAppsScriptProxyRequest } from "../server/appsScriptProxy/handler.mjs";

export default async function appsScriptProxy(request, response) {
  await handleAppsScriptProxyRequest(request, response);
}
