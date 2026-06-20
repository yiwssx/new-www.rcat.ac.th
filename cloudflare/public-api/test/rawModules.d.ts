declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*.mjs" {
  export const formatM19ParityReadiness: (result: {
    status: string;
    checks: Record<string, string>;
    externalOperatorBlockers: string[];
    safety: Record<string, boolean>;
    validationIssues: string[];
  }) => string;
  export const runM19ParityReadiness: (options?: {
    cwd?: string;
    readFile?: (path: string, encoding: string) => Promise<string>;
  }) => Promise<{
    status: string;
    checks: Record<string, string>;
    externalOperatorBlockers: string[];
    safety: Record<string, boolean>;
    validationIssues: string[];
  }>;
  export const formatM20ReadinessGate: (result: {
    status: string;
    checks: Record<string, string>;
    externalOperatorBlockers: string[];
    safety: Record<string, boolean>;
    validationIssues: string[];
  }) => string;
  export const runM20ReadinessGate: (options?: {
    cwd?: string;
    readFile?: (path: string, encoding: string) => Promise<string>;
  }) => Promise<{
    status: string;
    checks: Record<string, string>;
    externalOperatorBlockers: string[];
    safety: Record<string, boolean>;
    validationIssues: string[];
  }>;
  export const formatPublicDocumentsImportDryRunResult: (
    result: {
      status: string;
      summary: Record<string, unknown>;
      validationIssues: Array<{ index: number | null; messages: string[] }>;
      snapshot: { items: Array<Record<string, unknown>>; generatedAt: string | null };
    },
    options?: { json?: boolean }
  ) => string;
  export const runPublicDocumentsImportDryRun: (
    args?: string[],
    options?: {
      cwd?: string;
      generatedAt?: Date;
      readFile?: (inputPath: string, encoding: string) => Promise<string>;
    }
  ) => Promise<{
    status: string;
    summary: {
      inputPath: string;
      sourceRecordCount: number;
      transformedRowCount: number;
      publicItemCount: number;
      excludedDraftInactiveCount: number;
      validationErrorCount: number;
      firstPublicItemIds: string[];
      generatedAt: string | null;
    };
    validationIssues: Array<{ index: number | null; messages: string[] }>;
    snapshot: { items: Array<Record<string, unknown>>; generatedAt: string | null };
  }>;
  export const validatePublicDocumentD1ImportRow: (row: Record<string, unknown>) => string[];
  export const formatPublicDocumentsImportManifestDryRunResult: (
    result: {
      status: string;
      manifest: Record<string, unknown>;
    },
    options?: { json?: boolean }
  ) => string;
  export const runPublicDocumentsImportManifestDryRun: (
    args?: string[],
    options?: {
      readFile?: (inputPath: string, encoding: string) => Promise<string>;
    }
  ) => Promise<{
    status: string;
    manifest: {
      manifestVersion: number;
      checkpoint: string;
      scope: string;
      status: string;
      input: {
        path: string;
        sha256: string | null;
        sourceType: string;
      };
      dryRun: {
        sourceRecordCount: number;
        transformedRowCount: number;
        publicItemCount: number;
        excludedDraftInactiveCount: number;
        validationErrorCount: number;
        firstPublicItemIds: string[];
        generatedAt: string | null;
      };
      checks: Record<string, string>;
      safety: Record<string, boolean>;
      validationIssues: Array<{ index: number | null; messages: string[] }>;
    };
  }>;
  export const formatPublicDocumentsProductionImportResult: (
    result: {
      status: string;
      manifest: Record<string, unknown>;
    },
    options?: { json?: boolean }
  ) => string;
  export const getProductionImportExitCode: (status: string) => number;
  export const isProductionImportInputPathAllowed: (inputPath: string, repoRoot?: string) => boolean;
  export const runPublicDocumentsProductionImport: (
    args?: string[],
    options?: {
      env?: Record<string, string | undefined>;
      readFile?: (inputPath: string, encoding: string) => Promise<string>;
      execute?: (input: { command: string; args: string[] }) => Promise<{ code: number }>;
      writeTempSql?: (sql: string) => Promise<string>;
      cleanupTempSql?: (filePath: string) => Promise<void>;
    }
  ) => Promise<{
    status: string;
    manifest: {
      checkpoint: string;
      scope: string;
      mode: string;
      status: string;
      input: {
        pathLabel: string;
        sha256: string | null;
        sourceRecordCount: number;
      };
      validation: Record<string, string>;
      import: {
        targetDatabaseNameLabel: string;
        targetDatabaseIdRedacted: string | null;
        rowCount: number;
        batchCount: number;
        executedAt: string | null;
      };
      firstPublicItemIds: string[];
      safety: Record<string, boolean>;
      validationIssues: Array<{ index: number | null; messages: string[] }>;
    };
  }>;
  export const formatPublicDocumentsProductionWorkerSmokeResult: (
    result: {
      status: string;
      manifest: Record<string, unknown>;
    },
    options?: { json?: boolean }
  ) => string;
  export const getProductionWorkerSmokeExitCode: (status: string) => number;
  export const runPublicDocumentsProductionWorkerSmoke: (
    args?: string[],
    options?: {
      env?: Record<string, string | undefined>;
      fetch?: (
        input: string,
        init?: Record<string, unknown>
      ) => Promise<{
        ok: boolean;
        status: number;
        json: () => Promise<unknown>;
      }>;
    }
  ) => Promise<{
    status: string;
    manifest: {
      checkpoint: string;
      scope: string;
      status: string;
      target: {
        workerUrlLabel: string;
        endpoint: string;
      };
      http: {
        status: number | null;
        ok: boolean;
      };
      snapshot: {
        itemCount: number;
        expectedMinCount: number;
        firstPublicItemIds: string[];
        generatedAt: string | null;
      };
      checks: Record<string, string>;
      safety: Record<string, boolean>;
      validationIssues: Array<{ index: number | null; messages: string[] }>;
    };
  }>;
  export const formatPublicDocumentsProductionCutoverResult: (
    result: {
      status: string;
      manifest: Record<string, unknown>;
    },
    options?: { json?: boolean }
  ) => string;
  export const getProductionCutoverExitCode: (status: string) => number;
  export const runPublicDocumentsProductionCutover: (
    args?: string[],
    options?: {
      env?: Record<string, string | undefined>;
      fetch?: (
        input: string,
        init?: Record<string, unknown>
      ) => Promise<{
        ok: boolean;
        status: number;
        headers?: { get: (name: string) => string | null };
        json: () => Promise<unknown>;
        text: () => Promise<string>;
      }>;
      executeCommand?: (input: {
        command: string;
        args: string[];
        env?: Record<string, string>;
      }) => Promise<{ code: number }>;
    }
  ) => Promise<{
    status: string;
    manifest: {
      checkpoint: string;
      scope: string;
      mode: string;
      status: string;
      target: {
        frontendUrlLabel: string;
        workerUrlLabel: string;
        providerBefore: string;
        providerTarget: string;
      };
      checks: Record<string, string>;
      verification: {
        itemCount: number;
        expectedMinCount: number;
        firstPublicItemIds: string[];
        generatedAt: string | null;
      };
      safety: Record<string, boolean>;
      validationIssues: Array<{ index: number | null; messages: string[] }>;
    };
  }>;
}
