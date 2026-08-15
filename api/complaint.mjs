import { handleComplaintRequest } from "../server/complaint/handler.mjs";
import { handleCspReportRequest } from "../server/cspReport/handler.mjs";

function getComplaintRoute(request) {
  const requestUrl = new URL(request.url || "/", "https://www.rcat.ac.th");
  return requestUrl.searchParams.get("_rcatComplaintRoute");
}

export default async function complaint(request, response) {
  if (getComplaintRoute(request) === "csp-report") {
    await handleCspReportRequest(request, response);
    return;
  }

  await handleComplaintRequest(request, response);
}
