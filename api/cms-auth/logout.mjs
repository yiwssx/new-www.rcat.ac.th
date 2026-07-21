import { handleCmsAuthLogout } from "../../server/cmsAuth/handlers.mjs";

export default async function cmsAuthLogout(request, response) {
  await handleCmsAuthLogout(request, response);
}
