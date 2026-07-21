import { handleCmsAuthSession } from "../../server/cmsAuth/handlers.mjs";

export default async function cmsAuthSession(request, response) {
  await handleCmsAuthSession(request, response);
}
