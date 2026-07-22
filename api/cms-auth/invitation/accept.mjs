import { handleCmsInvitationAccept } from "../../../server/cmsAuth/handlers.mjs";

export default async function cmsInvitationAccept(request, response) {
  await handleCmsInvitationAccept(request, response);
}
