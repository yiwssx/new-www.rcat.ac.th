import type { PublicHomeSnapshot } from "../../types";
import { PublicReadError } from "../public-read/errors";
import { getPublicJson, type PublicReadRequestOptions } from "../public-read/request";

const REQUIRED_HOME_ARRAYS = [
  "carouselSlides",
  "externalServices",
  "latestNews",
  "latestAnnouncements",
  "procurementItems",
  "jobOpportunityItems",
  "achievementItems",
  "programItems",
  "documentItems",
  "eventItems",
  "media"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function getPublicHomeSnapshot(options: PublicReadRequestOptions = {}): Promise<PublicHomeSnapshot> {
  const payload = await getPublicJson("/api/public/home", "public-home", options);

  if (!isRecord(payload.visitorStats) || typeof payload.generatedAt !== "string") {
    throw new PublicReadError("Cloudflare public-home response is missing visitorStats or generatedAt", {
      kind: "invalid-response",
      resource: "public-home"
    });
  }

  for (const key of REQUIRED_HOME_ARRAYS) {
    if (!Array.isArray(payload[key])) {
      throw new PublicReadError(`Cloudflare public-home response is missing ${key}`, {
        kind: "invalid-response",
        resource: "public-home"
      });
    }
  }

  return payload as unknown as PublicHomeSnapshot;
}
