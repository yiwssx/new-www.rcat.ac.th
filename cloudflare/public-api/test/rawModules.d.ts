declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*.mjs" {
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
}
