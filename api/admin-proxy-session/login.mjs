import { handleAdminProxySessionLogin } from "../../server/adminProxy/handlers.mjs";

export default async function adminProxySessionLogin(request, response) {
  await handleAdminProxySessionLogin(request, response);
}
