import { handleCmsPasswordResetComplete } from "../../../server/cmsAuth/handlers.mjs";

export default async function cmsPasswordResetComplete(request, response) {
  await handleCmsPasswordResetComplete(request, response);
}
