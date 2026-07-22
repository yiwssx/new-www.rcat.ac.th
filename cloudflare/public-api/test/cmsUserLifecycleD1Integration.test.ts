// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { runScenarios } from "./fixtures/cmsLifecycleD1Worker";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const wranglerPackage = require.resolve("wrangler/package.json");
const wranglerCli = join(dirname(wranglerPackage), "bin", "wrangler.js");
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const configPath = join(repositoryRoot, "cloudflare", "public-api", "wrangler.toml");

interface D1LikeResult<T = Record<string, unknown>> {
  meta: { changes: number; rows_written: number };
  results: T[];
  success: true;
}

class IsolatedD1Statement {
  private bindings: SQLInputValue[] = [];

  constructor(private readonly statement: StatementSync) {}

  bind(...bindings: unknown[]) {
    this.bindings = bindings.map(toSqliteInput);
    return this;
  }

  async all<T>(): Promise<D1LikeResult<T>> {
    return {
      results: this.statement.all(...this.bindings) as T[],
      success: true,
      meta: { changes: 0, rows_written: 0 }
    };
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = (this.statement.get(...this.bindings) ?? null) as Record<string, unknown> | null;

    if (!row || !column) {
      return row as T | null;
    }

    return (row[column] ?? null) as T | null;
  }

  async run<T>(): Promise<D1LikeResult<T>> {
    return this.runSynchronously<T>();
  }

  runSynchronously<T>(): D1LikeResult<T> {
    const result = this.statement.run(...this.bindings);
    const changes = Number(result.changes);
    return { results: [], success: true, meta: { changes, rows_written: changes } };
  }
}

function toSqliteInput(value: unknown): SQLInputValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return value as SQLInputValue;
  }

  throw new TypeError("unsupported isolated D1 binding");
}

function isolatedD1(database: DatabaseSync) {
  const binding = {
    prepare(sql: string) {
      return new IsolatedD1Statement(database.prepare(sql));
    },
    async batch(statements: IsolatedD1Statement[]) {
      database.exec("BEGIN IMMEDIATE");

      try {
        const results = statements.map((statement) => statement.runSynchronously());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(sql: string) {
      database.exec(sql);
      return { count: 0, duration: 0 };
    }
  };
  return binding as unknown as D1Database;
}

async function findSqliteFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return findSqliteFiles(path);
      }

      return entry.isFile() && entry.name.endsWith(".sqlite") ? [path] : [];
    })
  );
  return files.flat();
}

function containsLifecycleSchema(path: string) {
  const candidate = new DatabaseSync(path, { readOnly: true });

  try {
    return Boolean(
      candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_admin_users'").get()
    );
  } finally {
    candidate.close();
  }
}

describe("CMS user lifecycle repository with isolated D1", () => {
  it("runs migrations 0001-0012 and preserves atomic one-time lifecycle operations", async () => {
    const persistPath = await mkdtemp(join(tmpdir(), "rcat-cms-lifecycle-d1-"));
    const safeTempRoot = `${resolve(tmpdir())}${sep}`;

    if (!resolve(persistPath).startsWith(safeTempRoot) || !basename(persistPath).startsWith("rcat-cms-lifecycle-d1-")) {
      throw new Error("unsafe D1 integration temporary path");
    }

    let sqlite: DatabaseSync | null = null;

    try {
      const migration = await execFileAsync(
        process.execPath,
        [
          wranglerCli,
          "d1",
          "migrations",
          "apply",
          "rcat-public-api-local",
          "--local",
          "--persist-to",
          persistPath,
          "--config",
          configPath
        ],
        { cwd: repositoryRoot, env: { ...process.env, CI: "true", NO_COLOR: "1" }, maxBuffer: 2 * 1024 * 1024 }
      );
      expect(migration.stdout).toContain("0012_cms_auth_identity_constraints.sql");

      const sqliteFiles = await findSqliteFiles(persistPath);
      const lifecycleDatabases = sqliteFiles.filter(containsLifecycleSchema);
      expect(lifecycleDatabases).toHaveLength(1);
      sqlite = new DatabaseSync(lifecycleDatabases[0]);
      sqlite.exec("PRAGMA foreign_keys = ON");
      const body = await runScenarios({ DB: isolatedD1(sqlite) } as Env);

      expect(body.atomicRollback).toEqual({ rejected: true, users: 0, invitations: 0, audits: 0 });
      expect(body.created).toMatchObject({ users: 1, invitations: 1, credentials: 0, invitedAudits: 1 });
      expect(body.created.storedTokenHash).toBe(body.hashes.invitationHash);
      expect(body.created.storedTokenHash).not.toBe(body.rawTokens.invitationRaw);
      expect(body.accepted).toMatchObject({
        credentials: 1,
        passwordHash: "accepted-password-hash",
        acceptedAt: "2026-07-22T06:00:00.000Z",
        acceptedAudits: 1,
        secondRejected: true
      });
      expect(body.reset).toMatchObject({
        passwordHash: "reset-password-hash",
        storedTokenHash: body.hashes.resetHash,
        usedAt: "2026-07-22T06:00:00.000Z",
        resetAudits: 1,
        secondRejected: true
      });
      expect(body.reset.storedTokenHash).not.toBe(body.rawTokens.resetRaw);
      expect(body.failedEligibility).toEqual({
        rejected: true,
        user: { must_change_password: 1, revision: 0, session_version: 1, username: null },
        credentials: 0,
        invitation: {
          accepted_at: "",
          revoked_at: "",
          token_hash: body.hashes.failedHash
        },
        acceptedAudits: 0
      });
      expect(body.failedEligibility.invitation?.token_hash).not.toBe(body.rawTokens.failedRaw);

      sqlite.close();
      sqlite = null;
      const d1Readback = await execFileAsync(
        process.execPath,
        [
          wranglerCli,
          "d1",
          "execute",
          "rcat-public-api-local",
          "--local",
          "--persist-to",
          persistPath,
          "--config",
          configPath,
          "--command",
          "SELECT id FROM app_admin_users WHERE id = 'accepted-user'"
        ],
        { cwd: repositoryRoot, env: { ...process.env, CI: "true", NO_COLOR: "1" }, maxBuffer: 1024 * 1024 }
      );
      expect(d1Readback.stdout).toContain("accepted-user");
    } finally {
      sqlite?.close();
      await rm(persistPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
    }
  }, 60_000);
});
