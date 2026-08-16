import { handleCmsAuthDispatch } from "../server/cmsAuth/dispatcher.mjs";

export default async function cmsAuth(request, response) {
  await handleCmsAuthDispatch(request, response);
}
