import { handleCmsAuthLogin } from "../../server/cmsAuth/handlers.mjs";

export default async function cmsAuthLogin(request, response) {
  await handleCmsAuthLogin(request, response);
}
