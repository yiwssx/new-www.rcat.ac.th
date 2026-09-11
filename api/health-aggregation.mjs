import { handleHealthAggregationRequest } from "../server/healthAggregation/handler.mjs";

export default async function healthAggregation(request, response) {
  await handleHealthAggregationRequest(request, response);
}
