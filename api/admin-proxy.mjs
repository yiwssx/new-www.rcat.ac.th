import { handleAdminProxyRequest } from "../server/adminProxy/handlers.mjs";

export default async function adminProxy(request, response) {
  await handleAdminProxyRequest(request, response);
}
