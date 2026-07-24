import type { CmsAssurance } from "./types";

export interface CmsStepUpSnapshot {
  open: boolean;
  assurance: CmsAssurance;
}

export class CmsStepUpCancelledError extends Error {
  constructor() {
    super("Reauthentication was cancelled");
    this.name = "CmsStepUpCancelledError";
  }
}

export class CmsStepUpReplayError extends Error {
  constructor() {
    super("The request body cannot be replayed safely");
    this.name = "CmsStepUpReplayError";
  }
}

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

function createDeferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class CmsStepUpCoordinator {
  private deferred: Deferred | null = null;
  private listeners = new Set<() => void>();
  private snapshot: CmsStepUpSnapshot = { open: false, assurance: "password" };

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  request(assurance: CmsAssurance) {
    if (!this.deferred) {
      this.deferred = createDeferred();
      this.snapshot = { open: true, assurance };
      this.emit();
    } else if (assurance === "mfa" && this.snapshot.assurance !== "mfa") {
      this.snapshot = { open: true, assurance: "mfa" };
      this.emit();
    }

    return this.deferred.promise;
  }

  complete() {
    const deferred = this.deferred;

    if (!deferred) {
      return;
    }

    this.deferred = null;
    this.snapshot = { open: false, assurance: "password" };
    this.emit();
    deferred.resolve();
  }

  cancel() {
    const deferred = this.deferred;

    if (!deferred) {
      return;
    }

    this.deferred = null;
    this.snapshot = { open: false, assurance: "password" };
    this.emit();
    deferred.reject(new CmsStepUpCancelledError());
  }

  resetForTests() {
    this.cancel();
    this.listeners.clear();
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const cmsStepUpCoordinator = new CmsStepUpCoordinator();

export function isReplayableRequestBody(body: BodyInit | null | undefined) {
  return (
    body === undefined ||
    body === null ||
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  );
}
