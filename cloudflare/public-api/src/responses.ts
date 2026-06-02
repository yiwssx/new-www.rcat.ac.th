import { getCorsHeaders } from "./cors";
import type { Env } from "./env";

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return json(
    {
      error: message,
      ...extra
    },
    {
      status
    }
  );
}

export function notFound() {
  return jsonError("not found", 404);
}

export function methodNotAllowed() {
  return jsonError("method not allowed", 405, {});
}

export function withCors(response: Response, request: Request, env: Env) {
  const headers = new Headers(response.headers);

  getCorsHeaders(request, env).forEach((value, key) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  });
}
