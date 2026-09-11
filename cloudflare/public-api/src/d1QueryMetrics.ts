import type { Env } from "./env";

interface D1MetaLike {
  duration?: number;
  rows_read?: number;
  rows_written?: number;
  changes?: number;
}

interface D1ResultLike {
  meta?: D1MetaLike;
}

function finiteMetric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function logD1QueryMetrics(env: Env, operation: string, result: D1ResultLike) {
  if (env.ENVIRONMENT !== "production" || !result.meta) {
    return;
  }

  const rowsRead = finiteMetric(result.meta.rows_read);
  const rowsWritten = finiteMetric(result.meta.rows_written);

  console.info(
    JSON.stringify({
      event: "d1-query-metrics",
      operation,
      rowsRead,
      rowsWritten,
      durationMs: finiteMetric(result.meta.duration),
      changes: finiteMetric(result.meta.changes)
    })
  );
}
