import { handleComplaintRequest } from "../server/complaint/handler.mjs";
import { handleCspReportRequest } from "../server/cspReport/handler.mjs";

export default async function complaint(request, response) {
  if (request.query?._rcatComplaintRoute === "csp-report") {
    await handleCspReportRequest(request, response);
    return;
  }

  await handleComplaintRequest(request, response);
}
