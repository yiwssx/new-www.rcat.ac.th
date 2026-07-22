import { handleCmsInvitationInspect } from "../../../server/cmsAuth/handlers.mjs";

export default async function cmsInvitationInspect(request, response) {
  await handleCmsInvitationInspect(request, response);
}
