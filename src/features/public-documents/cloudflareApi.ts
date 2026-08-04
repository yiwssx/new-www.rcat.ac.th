import { asInvalidPublicReadResponse, getPublicJson, type PublicReadRequestOptions } from "../public-read/request";
import { assertPublicDocumentListSnapshot } from "./contract";
import type { PublicDocumentListSnapshot } from "./types";

export async function getPublicDocumentListFromCloudflare(
  options: PublicReadRequestOptions = {}
): Promise<PublicDocumentListSnapshot> {
  const payload = await getPublicJson("/api/public/documents", "public-document-list", {
    ...options,
    httpErrorMessage: "generic"
  });

  try {
    assertPublicDocumentListSnapshot(payload);
  } catch (error) {
    throw asInvalidPublicReadResponse("public-document-list", error);
  }

  return payload;
}
