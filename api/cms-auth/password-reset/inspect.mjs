import { handleCmsPasswordResetInspect } from "../../../server/cmsAuth/handlers.mjs";

export default async function cmsPasswordResetInspect(request, response) {
  await handleCmsPasswordResetInspect(request, response);
}
