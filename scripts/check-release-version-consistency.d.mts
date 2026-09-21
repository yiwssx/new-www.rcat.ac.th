export interface ReleaseVersionConsistencyInput {
  packageVersion: string;
  changelog: string;
  tags: string[];
  releaseTag?: string;
}

export interface ReleaseVersionConsistencyResult {
  errors: string[];
  warnings: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string;
}

export function compareSemver(left: string, right: string): number;
export function parseChangelogReleases(changelog: string): ChangelogRelease[];
export function validateReleaseVersionConsistency(
  input: ReleaseVersionConsistencyInput
): ReleaseVersionConsistencyResult;
