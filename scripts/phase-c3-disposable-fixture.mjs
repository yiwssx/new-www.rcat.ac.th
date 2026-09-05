import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import bcrypt from "bcryptjs";

const PASSWORD_ALGORITHM = "bcrypt-sha384-v1";
const PASSWORD_DOMAIN = "rcat-cms-password-v1:";
const PASSWORD_BCRYPT_COST = 12;
const ACTOR = "phase-c3-field";

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function getRunnerFile(name) {
  return join(requireEnv("RUNNER_TEMP"), name);
}

function getCountRow(filePath) {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  const statements = Array.isArray(parsed) ? parsed : [parsed];
  const rows = statements.flatMap((statement) => (Array.isArray(statement?.results) ? statement.results : []));
  const row = rows.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      "qa_user_count" in candidate &&
      "qa_credential_count" in candidate &&
      "qa_session_count" in candidate &&
      "qa_content_count" in candidate
  );

  if (!row) {
    throw new Error("Phase C3 verification query did not return the expected count row");
  }

  return {
    user: Number(row.qa_user_count),
    credential: Number(row.qa_credential_count),
    session: Number(row.qa_session_count),
    content: Number(row.qa_content_count)
  };
}

function assertCounts(filePath, expected) {
  const actual = getCountRow(filePath);
  if (Object.entries(expected).some(([key, value]) => actual[key] !== value)) {
    throw new Error(`Phase C3 fixture state mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`[Phase C3] disposable fixture state verified: ${JSON.stringify(actual)}`);
}

async function prepare() {
  const runId = requireEnv("GITHUB_RUN_ID").replace(/[^0-9]/g, "");
  const runAttempt = requireEnv("GITHUB_RUN_ATTEMPT").replace(/[^0-9]/g, "");
  const githubEnv = requireEnv("GITHUB_ENV");

  if (!runId || !runAttempt) {
    throw new Error("GitHub run identity is invalid");
  }

  const runKey = `${runId}-${runAttempt}`;
  const userId = `phase-c3-qa-${runKey}`;
  const username = `phasec3_${runId}_${runAttempt}`;
  const email = `phase-c3-${runKey}@qa.invalid`;
  const title = `Phase C3 QA ${runKey}`;
  const slug = `phase-c3-qa-${runKey}`;
  const facebookUrl = `https://example.invalid/${slug}`;
  const password = `C3-${randomBytes(24).toString("base64url")}!aA1`;
  const digest = createHash("sha384").update(password, "utf8").digest("base64url");
  const passwordHash = await bcrypt.hash(`${PASSWORD_DOMAIN}${digest}`, PASSWORD_BCRYPT_COST);
  const now = new Date().toISOString();

  console.log(`::add-mask::${password}`);
  console.log(`::add-mask::${passwordHash}`);

  appendFileSync(
    githubEnv,
    [
      `PHASE_C3_QA_USER_ID=${userId}`,
      `PHASE_C3_QA_USERNAME=${username}`,
      `PHASE_C3_QA_PASSWORD=${password}`,
      `PHASE_C3_CONTENT_SLUG=${slug}`,
      `PHASE_C3_CONTENT_TITLE=${title}`,
      `PHASE_C3_FACEBOOK_URL=${facebookUrl}`
    ].join("\n") + "\n"
  );

  const provisionSql = `PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;
INSERT INTO app_admin_users
  (id, email, name, role, status, created_at, updated_at, created_by, updated_by, revision,
   username, is_root, must_change_password, mfa_required, session_version, last_login_at)
VALUES
  (${sqlText(userId)}, ${sqlText(email)}, ${sqlText("Phase C3 Disposable QA")}, 'editor', 'active',
   ${sqlText(now)}, ${sqlText(now)}, ${sqlText(ACTOR)}, ${sqlText(ACTOR)}, 0,
   ${sqlText(username)}, 0, 0, 0, 1, '');
INSERT INTO admin_credentials
  (user_id, password_hash, password_algorithm, password_changed_at, failed_login_count, locked_until, created_at, updated_at)
VALUES
  (${sqlText(userId)}, ${sqlText(passwordHash)}, ${sqlText(PASSWORD_ALGORITHM)}, ${sqlText(now)}, 0, '',
   ${sqlText(now)}, ${sqlText(now)});
COMMIT;
`;

  const cleanupSql = `PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;
DELETE FROM contents WHERE slug = ${sqlText(slug)};
DELETE FROM app_admin_users WHERE id = ${sqlText(userId)} AND is_root = 0;
COMMIT;
`;

  const verifySql = `SELECT
  (SELECT COUNT(*) FROM app_admin_users WHERE id = ${sqlText(userId)}) AS qa_user_count,
  (SELECT COUNT(*) FROM admin_credentials WHERE user_id = ${sqlText(userId)}) AS qa_credential_count,
  (SELECT COUNT(*) FROM admin_sessions WHERE user_id = ${sqlText(userId)}) AS qa_session_count,
  (SELECT COUNT(*) FROM contents WHERE slug = ${sqlText(slug)}) AS qa_content_count;
`;

  writeFileSync(getRunnerFile("phase-c3-provision.sql"), provisionSql, { mode: 0o600 });
  writeFileSync(getRunnerFile("phase-c3-cleanup.sql"), cleanupSql, { mode: 0o600 });
  writeFileSync(getRunnerFile("phase-c3-verify.sql"), verifySql, { mode: 0o600 });

  console.log(`[Phase C3] prepared isolated editor and disposable slug ${slug}`);
}

const command = process.argv[2];

if (command === "prepare") {
  await prepare();
} else if (command === "assert-clean") {
  assertCounts(process.argv[3], { user: 0, credential: 0, session: 0, content: 0 });
} else if (command === "assert-provisioned") {
  assertCounts(process.argv[3], { user: 1, credential: 1, session: 0, content: 0 });
} else {
  throw new Error("Usage: phase-c3-disposable-fixture.mjs <prepare|assert-clean|assert-provisioned> [result.json]");
}
