import { jsonError } from "../responses";

export function publicDocuments() {
  return jsonError("public-document-list is not implemented in M1 skeleton", 501, {
    resource: "public-document-list",
    phase: "M1"
  });
}
