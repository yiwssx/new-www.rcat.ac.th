import { asInvalidPublicReadResponse, getPublicJson, type PublicReadRequestOptions } from "../public-read/request";
import { assertPublicEventListSnapshot } from "./contract";
import type { PublicEventListSnapshot } from "./types";

export async function getPublicEventListFromCloudflare(
  options: PublicReadRequestOptions = {}
): Promise<PublicEventListSnapshot> {
  const payload = await getPublicJson("/api/public/events", "public-event-list", options);

  try {
    assertPublicEventListSnapshot(payload);
  } catch (error) {
    throw asInvalidPublicReadResponse("public-event-list", error);
  }

  return payload;
}
