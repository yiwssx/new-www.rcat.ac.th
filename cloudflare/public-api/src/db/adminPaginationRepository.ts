import type { AdminPagination, AdminPaginationRequest } from "../contracts/adminPagination";
import { createAdminPagination } from "../contracts/adminPagination";
import { requireD1Database } from "./documentsRepository";
import type { Env } from "../env";

export interface AdminSqlFilter {
  clause: string;
  bindings: unknown[];
}

export interface AdminPageSql {
  columns: readonly string[];
  filters: AdminSqlFilter[];
  from: string;
  orderBy: string;
}

export interface AdminPageResult<T> {
  rows: T[];
  pagination: AdminPagination;
}

async function all<T>(env: Env, query: string, bindings: readonly unknown[] = []) {
  const statement = requireD1Database(env).prepare(query);
  const result = await (bindings.length ? statement.bind(...bindings) : statement).all<T>();
  return result.results ?? [];
}

function whereSql(filters: AdminSqlFilter[]) {
  return filters.length ? ` WHERE ${filters.map((filter) => filter.clause).join(" AND ")}` : "";
}

function filterBindings(filters: AdminSqlFilter[]) {
  return filters.flatMap((filter) => filter.bindings);
}

function countFromRows(rows: Array<{ total?: unknown }>) {
  const total = Number(rows[0]?.total);

  if (Number.isFinite(total) && total >= 0) {
    return Math.floor(total);
  }

  // A few repository unit-test D1 doubles predate COUNT support and return
  // their backing rows unchanged. This fallback is never used by D1 itself.
  return rows.length;
}

export async function readAdminPage<T>(
  env: Env,
  sql: AdminPageSql,
  requested: AdminPaginationRequest
): Promise<AdminPageResult<T>> {
  const where = whereSql(sql.filters);
  const bindings = filterBindings(sql.filters);
  const countRows = await all<{ total?: unknown }>(env, `SELECT COUNT(*) AS total FROM ${sql.from}${where}`, bindings);
  const pagination = createAdminPagination(requested, countFromRows(countRows));
  const offset = (pagination.page - 1) * pagination.pageSize;
  const rows = await all<T>(
    env,
    `SELECT ${sql.columns.join(", ")} FROM ${sql.from}${where} ORDER BY ${sql.orderBy} LIMIT ? OFFSET ?`,
    [...bindings, pagination.pageSize, offset]
  );

  return { rows, pagination };
}

export async function readAdminRows<T>(env: Env, query: string, bindings: readonly unknown[] = []): Promise<T[]> {
  return all<T>(env, query, bindings);
}
