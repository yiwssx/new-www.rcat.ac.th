export type PublicReadErrorKind = "aborted" | "network" | "http" | "invalid-json" | "invalid-response";

export interface PublicReadErrorOptions {
  kind: PublicReadErrorKind;
  resource: string;
  status?: number;
  backendMessage?: string;
  diagnostic?: string;
  suggestedMigration?: string;
  cause?: unknown;
}

export class PublicReadError extends Error {
  readonly kind: PublicReadErrorKind;
  readonly resource: string;
  readonly status?: number;
  readonly backendMessage: string;
  readonly diagnostic: string;
  readonly suggestedMigration: string;

  constructor(message: string, options: PublicReadErrorOptions) {
    super(message);

    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }

    this.name = "PublicReadError";
    this.kind = options.kind;
    this.resource = options.resource;
    this.status = options.status;
    this.backendMessage = options.backendMessage ?? "";
    this.diagnostic = options.diagnostic ?? "";
    this.suggestedMigration = options.suggestedMigration ?? "";
  }
}

export function isPublicReadError(error: unknown): error is PublicReadError {
  return error instanceof PublicReadError;
}

export function isPublicReadAbortError(error: unknown) {
  return error instanceof PublicReadError && error.kind === "aborted";
}

export function isPublicReadNotFoundError(error: unknown) {
  return error instanceof PublicReadError && error.kind === "http" && error.status === 404;
}

export function isAbortLikeError(error: unknown) {
  return (
    (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
