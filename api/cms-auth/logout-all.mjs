import { handleCmsAuthLogoutAll } from "../../server/cmsAuth/handlers.mjs";

export default async function cmsAuthLogoutAll(request, response) {
  await handleCmsAuthLogoutAll(request, response);
}
