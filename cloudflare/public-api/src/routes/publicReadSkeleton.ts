import type { PublicReadNotImplementedContract, PublicReadResource } from "../contracts/publicRead";
import { json } from "../responses";

export function publicReadNotImplemented(resource: Exclude<PublicReadResource, "public-document-list">) {
  const payload: PublicReadNotImplementedContract = {
    error: "Not implemented",
    resource,
    phase: "M17"
  };

  return json(payload, {
    status: 501
  });
}
