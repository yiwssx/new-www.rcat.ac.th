/* global URL */
// Shared read-only contract assertion for the actual Cloudflare-owned Public APIs.
// Public home and public shell have deliberately different payload schemas.
// This module performs no network, credential, database or deployment actions.
import assert from "node:assert/strict";

const HOME_ARRAYS = Object.freeze([
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
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assertPublicApiContract(path, payload) {
  assert.ok(isObject(payload), path + " expected a JSON object");
  assert.equal(typeof payload.generatedAt, "string", path + " missing generatedAt");
  assert.ok(Number.isFinite(Date.parse(payload.generatedAt)), path + " invalid generatedAt");

  switch (path) {
    case "/api/public/home":
      assert.ok(isObject(payload.visitorStats), path + " missing visitorStats");
      for (const field of HOME_ARRAYS) {
        assert.ok(Array.isArray(payload[field]), path + " missing " + field);
      }
      if (payload.generalAnnouncementItems !== undefined) {
        assert.ok(Array.isArray(payload.generalAnnouncementItems), path + " invalid generalAnnouncementItems");
      }
      return;
    case "/api/public/shell":
      assert.ok(Array.isArray(payload.menu), path + " missing menu");
      for (const field of ["siteSettings", "homepageSettings", "displaySettings"]) {
        assert.ok(isObject(payload[field]), path + " missing " + field);
      }
      return;
    default:
      throw new Error("Unexpected Cloudflare Public API contract path");
  }
}
