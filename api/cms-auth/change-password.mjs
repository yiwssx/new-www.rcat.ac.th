import { handleCmsPasswordChange } from "../../server/cmsAuth/handlers.mjs";

export default async function cmsPasswordChange(request, response) {
  await handleCmsPasswordChange(request, response);
}
