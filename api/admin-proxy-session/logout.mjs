import { handleAdminProxySessionLogout } from "../../server/adminProxy/handlers.mjs";

export default async function adminProxySessionLogout(request, response) {
  await handleAdminProxySessionLogout(request, response);
}
