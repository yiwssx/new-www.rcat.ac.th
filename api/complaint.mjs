import { handleComplaintRequest } from "../server/complaint/handler.mjs";

export default async function complaint(request, response) {
  await handleComplaintRequest(request, response);
}
