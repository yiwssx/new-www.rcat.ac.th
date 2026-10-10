import type { OrganizationUnitInput } from "../db/organizationUnitLifecycle";
import { OrganizationInputError, parseOrganizationUnitWrite } from "./organizationWriteValidation";

const STATUSES = ["draft", "review", "scheduled", "published"] as const;
const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "documents",
  "login",
  "news",
  "organization",
  "personnel",
  "sitemap",
  "robots",
  "search"
]);

function optionalText(value: unknown, field: string, limit: number, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string") throw new OrganizationInputError(`invalid ${field}`);
  const text = value.trim();
  if (text.length > limit || (required && !text)) throw new OrganizationInputError(`invalid ${field}`);
  return text;
}

function instant(value: string, field: string): string {
  if (value && (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value)) {
    throw new OrganizationInputError(`invalid ${field}`);
  }
  return value;
}

export function parseOrganizationContentUnitWrite(
  value: unknown,
  now = new Date().toISOString()
): OrganizationUnitInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrganizationInputError("request body must be an object");
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set([
    "slug",
    "title",
    "summary",
    "status",
    "publishAt",
    "unpublishAt",
    "parentContentId",
    "unitKind",
    "sortOrder"
  ]);
  const protectedKey = Object.keys(body).find((field) => !allowed.has(field));
  if (protectedKey) throw new OrganizationInputError(`unknown or protected field: ${protectedKey}`);

  const slug = optionalText(body.slug, "slug", 160, true).toLowerCase();
  if (!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug) || RESERVED.has(slug)) {
    throw new OrganizationInputError("invalid or reserved organization slug");
  }
  const status = body.status ?? "draft";
  if (typeof status !== "string" || !STATUSES.some((value) => value === status)) {
    throw new OrganizationInputError("invalid organization publication status");
  }
  let publishAt = instant(optionalText(body.publishAt, "publishAt", 24), "publishAt");
  const unpublishAt = instant(optionalText(body.unpublishAt, "unpublishAt", 24), "unpublishAt");
  if (status === "scheduled" && (!publishAt || Date.parse(publishAt) <= Date.parse(now))) {
    throw new OrganizationInputError("scheduled organization requires a future publishAt");
  }
  if (status === "published" && !publishAt) publishAt = now;
  if (unpublishAt && (!publishAt || Date.parse(unpublishAt) <= Date.parse(publishAt))) {
    throw new OrganizationInputError("unpublishAt must follow publishAt");
  }
  const unit = parseOrganizationUnitWrite({
    parentContentId: body.parentContentId,
    unitKind: body.unitKind,
    sortOrder: body.sortOrder
  });

  return {
    slug,
    title: optionalText(body.title, "title", 250, true),
    summary: optionalText(body.summary, "summary", 2000),
    status: status as OrganizationUnitInput["status"],
    publishAt,
    unpublishAt,
    ...unit
  };
}
