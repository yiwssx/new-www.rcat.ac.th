import fs from "node:fs";
import { pathToFileURL } from "node:url";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_ROWS_READ_LIMIT = 5_000_000;
const DEFAULT_ROWS_WRITTEN_LIMIT = 100_000;
const DEFAULT_THRESHOLDS = {
  info: 0.5,
  warning: 0.7,
  critical: 0.85
};

const D1_ANALYTICS_QUERY = `query D1ProductionUsage(
  $accountTag: string!
  $start: Date
  $endExclusive: Date
) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      d1AnalyticsAdaptiveGroups(
        limit: 10000
        filter: { date_geq: $start, date_lt: $endExclusive }
        orderBy: [date_ASC]
      ) {
        sum {
          readQueries
          writeQueries
          rowsRead
          rowsWritten
        }
        dimensions {
          date
          databaseId
        }
      }
    }
  }
}`;

function requirePositiveNumber(value, fallback, label) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return parsed;
}

function requireRatio(value, fallback, label) {
  const parsed = requirePositiveNumber(value, fallback, label);
  if (parsed >= 1) throw new Error(`${label} must be lower than 1`);
  return parsed;
}

function utcDateString(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function numberFrom(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function classifyUsageRatio(ratio, thresholds = DEFAULT_THRESHOLDS) {
  if (ratio >= thresholds.critical) return "critical";
  if (ratio >= thresholds.warning) return "warning";
  if (ratio >= thresholds.info) return "info";
  return "healthy";
}

function severityRank(severity) {
  return { healthy: 0, info: 1, warning: 2, critical: 3 }[severity] ?? 0;
}

function maxSeverity(...values) {
  return values.reduce((current, value) => (severityRank(value) > severityRank(current) ? value : current), "healthy");
}

export function aggregateD1AnalyticsGroups(groups) {
  const byDate = new Map();
  const byDatabase = new Map();

  for (const group of Array.isArray(groups) ? groups : []) {
    const date = String(group?.dimensions?.date ?? "").trim();
    const databaseId = String(group?.dimensions?.databaseId ?? "unknown").trim() || "unknown";
    if (!date) continue;

    const values = {
      rowsRead: numberFrom(group?.sum?.rowsRead),
      rowsWritten: numberFrom(group?.sum?.rowsWritten),
      readQueries: numberFrom(group?.sum?.readQueries),
      writeQueries: numberFrom(group?.sum?.writeQueries)
    };

    const daily = byDate.get(date) ?? {
      date,
      rowsRead: 0,
      rowsWritten: 0,
      readQueries: 0,
      writeQueries: 0
    };
    daily.rowsRead += values.rowsRead;
    daily.rowsWritten += values.rowsWritten;
    daily.readQueries += values.readQueries;
    daily.writeQueries += values.writeQueries;
    byDate.set(date, daily);

    const database = byDatabase.get(databaseId) ?? {
      databaseId,
      rowsRead: 0,
      rowsWritten: 0,
      readQueries: 0,
      writeQueries: 0
    };
    database.rowsRead += values.rowsRead;
    database.rowsWritten += values.rowsWritten;
    database.readQueries += values.readQueries;
    database.writeQueries += values.writeQueries;
    byDatabase.set(databaseId, database);
  }

  return {
    daily: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    databases: [...byDatabase.values()].sort((a, b) => b.rowsWritten - a.rowsWritten || b.rowsRead - a.rowsRead)
  };
}

export function buildD1UsageReport({ groups, now = new Date(), limits = {}, thresholds = {} }) {
  const resolvedLimits = {
    rowsRead: requirePositiveNumber(limits.rowsRead, DEFAULT_ROWS_READ_LIMIT, "rows read limit"),
    rowsWritten: requirePositiveNumber(limits.rowsWritten, DEFAULT_ROWS_WRITTEN_LIMIT, "rows written limit")
  };
  const resolvedThresholds = {
    info: requireRatio(thresholds.info, DEFAULT_THRESHOLDS.info, "info threshold"),
    warning: requireRatio(thresholds.warning, DEFAULT_THRESHOLDS.warning, "warning threshold"),
    critical: requireRatio(thresholds.critical, DEFAULT_THRESHOLDS.critical, "critical threshold")
  };

  if (!(
    resolvedThresholds.info < resolvedThresholds.warning && resolvedThresholds.warning < resolvedThresholds.critical
  )) {
    throw new Error("usage thresholds must be ordered info < warning < critical");
  }

  const aggregated = aggregateD1AnalyticsGroups(groups);
  const currentDate = utcDateString(now);
  const current = aggregated.daily.find((entry) => entry.date === currentDate) ?? {
    date: currentDate,
    rowsRead: 0,
    rowsWritten: 0,
    readQueries: 0,
    writeQueries: 0
  };

  const readRatio = current.rowsRead / resolvedLimits.rowsRead;
  const writeRatio = current.rowsWritten / resolvedLimits.rowsWritten;
  const readSeverity = classifyUsageRatio(readRatio, resolvedThresholds);
  const writeSeverity = classifyUsageRatio(writeRatio, resolvedThresholds);
  const severity = maxSeverity(readSeverity, writeSeverity);

  return {
    generatedAt: now.toISOString(),
    currentDate,
    severity,
    thresholds: resolvedThresholds,
    limits: resolvedLimits,
    current: {
      ...current,
      rowsReadRatio: readRatio,
      rowsWrittenRatio: writeRatio,
      rowsReadSeverity: readSeverity,
      rowsWrittenSeverity: writeSeverity
    },
    daily: aggregated.daily
  };
}

function formatPercent(value) {
  return `${(numberFrom(value) * 100).toFixed(1)}%`;
}

function dailyRatio(value, limit) {
  return limit > 0 ? numberFrom(value) / limit : 0;
}

export function formatD1UsageMarkdown(report) {
  const rows = report.daily.slice(-14).map((entry) => {
    const readRatio = dailyRatio(entry.rowsRead, report.limits.rowsRead);
    const writeRatio = dailyRatio(entry.rowsWritten, report.limits.rowsWritten);
    return `| ${entry.date} | ${formatPercent(readRatio)} | ${formatPercent(writeRatio)} |`;
  });

  return [
    "## P6A Production D1 Usage",
    "",
    `- Generated: ${report.generatedAt}`,
    `- UTC billing day: ${report.currentDate}`,
    `- Status: **${String(report.severity).toUpperCase()}**`,
    `- Rows read utilization: **${formatPercent(report.current.rowsReadRatio)}**`,
    `- Rows written utilization: **${formatPercent(report.current.rowsWrittenRatio)}**`,
    `- Thresholds: info ${formatPercent(report.thresholds.info)}, warning ${formatPercent(report.thresholds.warning)}, critical ${formatPercent(report.thresholds.critical)}`,
    "- Raw account/database identifiers and raw usage counts are intentionally not printed.",
    "",
    "### Recent daily utilization",
    "",
    "| UTC date | Rows read | Rows written |",
    "| --- | ---: | ---: |",
    ...(rows.length > 0 ? rows : ["| — | 0.0% | 0.0% |"]),
    ""
  ].join("\n");
}

export async function fetchD1Analytics({ accountId, token, start, endExclusive, fetchImpl = fetch }) {
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
  if (!token) throw new Error("CLOUDFLARE_ANALYTICS_READ_TOKEN is required");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetchImpl(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: D1_ANALYTICS_QUERY,
        variables: {
          accountTag: accountId,
          start,
          endExclusive
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Cloudflare GraphQL request failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      const message = payload.errors
        .map((entry) => entry?.message)
        .filter(Boolean)
        .join("; ");
      throw new Error(`Cloudflare GraphQL returned errors: ${message || "unknown error"}`);
    }

    const accounts = payload?.data?.viewer?.accounts;
    if (!Array.isArray(accounts) || accounts.length !== 1) {
      throw new Error(
        `expected exactly one Cloudflare account analytics result, found ${Array.isArray(accounts) ? accounts.length : 0}`
      );
    }

    return accounts[0]?.d1AnalyticsAdaptiveGroups ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

function writeGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(outputPath, `${name}=${String(value).replaceAll("\n", " ")}\n`, "utf8");
}

export async function runCli(env = process.env, now = new Date()) {
  const lookbackDays = Math.round(
    requirePositiveNumber(env.D1_USAGE_LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS, "lookback days")
  );
  const start = utcDateString(addUtcDays(now, -(lookbackDays - 1)));
  const endExclusive = utcDateString(addUtcDays(now, 1));
  const groups = await fetchD1Analytics({
    accountId: String(env.CLOUDFLARE_ACCOUNT_ID ?? "").trim(),
    token: String(env.CLOUDFLARE_ANALYTICS_READ_TOKEN ?? "").trim(),
    start,
    endExclusive
  });

  const report = buildD1UsageReport({
    groups,
    now,
    limits: {
      rowsRead: env.D1_DAILY_ROWS_READ_LIMIT,
      rowsWritten: env.D1_DAILY_ROWS_WRITTEN_LIMIT
    },
    thresholds: {
      info: env.D1_USAGE_INFO_RATIO,
      warning: env.D1_USAGE_WARNING_RATIO,
      critical: env.D1_USAGE_CRITICAL_RATIO
    }
  });

  const reportPath = String(env.D1_USAGE_REPORT_PATH || "production-observability-report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const markdown = formatD1UsageMarkdown(report);

  if (env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}\n`, "utf8");
  }

  const annotation = `${report.currentDate}: rows read ${formatPercent(report.current.rowsReadRatio)}, rows written ${formatPercent(report.current.rowsWrittenRatio)}.`;
  if (report.severity === "critical") {
    console.log(`::error title=D1 usage critical::${annotation}`);
  } else if (report.severity === "warning") {
    console.log(`::warning title=D1 usage warning::${annotation}`);
  } else if (report.severity === "info") {
    console.log(`::notice title=D1 usage watch::${annotation}`);
  } else {
    console.log(annotation);
  }

  writeGithubOutput("severity", report.severity);
  writeGithubOutput("report_path", reportPath);
  writeGithubOutput("rows_read_ratio", report.current.rowsReadRatio.toFixed(6));
  writeGithubOutput("rows_written_ratio", report.current.rowsWrittenRatio.toFixed(6));
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
