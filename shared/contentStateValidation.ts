export type EditorialWorkflowStatus = "draft" | "review";

export function validateEditorialTransition(currentStatus: string, targetStatus: unknown) {
  if (typeof targetStatus !== "string" || !["draft", "review"].includes(targetStatus)) {
    return { ok: false as const, error: "invalid editorial workflow status", status: 400 };
  }
  if (!["draft", "review"].includes(currentStatus)) {
    return {
      ok: false as const,
      error: "published or scheduled content must be unpublished before editorial workflow changes",
      status: 409
    };
  }
  return { ok: true as const, status: targetStatus as EditorialWorkflowStatus };
}

export function normalizeUnpublishAt(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

export function isValidFutureSchedule(value: unknown, now = new Date()) {
  if (typeof value !== "string" || !value.trim()) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}
