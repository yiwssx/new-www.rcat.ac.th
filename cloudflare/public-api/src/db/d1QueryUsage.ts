import type { Env } from "../env";

type D1ResultLike = {
  meta?: {
    rows_read?: number;
    rows_written?: number;
    duration?: number;
  };
};

export function logD1QueryUsage(env: Env, queryName: string, result: D1ResultLike) {
  if (env.ENVIRONMENT !== "production") {
    return;
  }

  const rowsRead = Math.max(0, Number(result.meta?.rows_read) || 0);
  const rowsWritten = Math.max(0, Number(result.meta?.rows_written) || 0);
  const durationMs = Math.max(0, Number(result.meta?.duration) || 0);

  if (rowsRead === 0 && rowsWritten === 0) {
    return;
  }

  console.info(
    "d1-query-usage",
    JSON.stringify({
      query: queryName,
      rowsRead,
      rowsWritten,
      durationMs
    })
  );
}
