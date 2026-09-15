import { handleFacebookOembedRequest } from "../server/facebookOembed/handler.mjs";

export default async function facebookOembed(request, response) {
  await handleFacebookOembedRequest(request, response);
}
