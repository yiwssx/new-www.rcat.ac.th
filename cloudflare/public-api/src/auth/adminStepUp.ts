import type { AdminIdentity } from "./adminAccess";
import type { Env } from "../env";
import { jsonError } from "../responses";

export const CMS_REAUTH_FRESHNESS_SECONDS = 10 * 60;
export type AdminStepUpAssurance = "password" | "mfa";

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

export function hasRecentAdminAssurance(
  identity: AdminIdentity,
  assurance: AdminStepUpAssurance,
  now: Date = new Date()
) {
  const value = assurance === "mfa" ? identity.mfaVerifiedAt : identity.reauthenticatedAt;
  if (!isCanonicalTimestamp(value)) return false;
  const age = now.getTime() - Date.parse(value);
  return age >= 0 && age < CMS_REAUTH_FRESHNESS_SECONDS * 1000;
}

function stepUpRequired(assurance: AdminStepUpAssurance) {
  const response = jsonError("reauthentication required", 428, {
    resource: "admin-structured-data",
    assurance
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function isMutation(method: string) {
  return method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
}

function baseRequirement(method: string, segments: readonly string[]): AdminStepUpAssurance | null {
  if (method === "POST" && segments[0] === "auth" && segments[1] === "bootstrap-root-credential") return "mfa";
  if (segments[0] === "users") {
    if (segments.length === 1 && method === "POST") return "password";
    if (segments.length === 2 && (method === "PATCH" || method === "DELETE")) return "password";
    if (
      segments.length === 3 &&
      ["invitations", "password-reset", "revoke-sessions"].includes(segments[2]) &&
      (method === "POST" || method === "DELETE")
    )
      return "password";
    if (segments.length === 3 && ["mfa", "mfa-requirement"].includes(segments[2])) return "mfa";
  }
  if (method === "GET" && segments[0] === "backup" && segments[1] === "download") return "password";
  if (isMutation(method) && ["settings", "menu", "external-services"].includes(segments[0])) return "password";
  return null;
}

async function targetsRoot(env: Env, segments: readonly string[]) {
  if (!env.DB || segments[0] !== "users" || segments.length < 2 || segments[1] === "me") return false;
  const row = await env.DB.prepare("SELECT is_root FROM app_admin_users WHERE id = ?").bind(segments[1]).first<{
    is_root: number;
  }>();
  return row?.is_root === 1;
}

export async function requireAdminStepUp(input: {
  env: Env;
  identity: AdminIdentity;
  method: string;
  segments: readonly string[];
  now?: Date;
}) {
  if (input.identity.mode !== "cms-session") return null;
  let requirement = baseRequirement(input.method, input.segments);
  const targetsCurrentRoot =
    input.segments[0] === "users" && input.segments[1] === "me" && input.identity.isRoot === true;
  if (targetsCurrentRoot || (await targetsRoot(input.env, input.segments))) requirement = "mfa";
  return requirement && !hasRecentAdminAssurance(input.identity, requirement, input.now)
    ? stepUpRequired(requirement)
    : null;
}
