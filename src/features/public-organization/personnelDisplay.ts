export function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/gu, " ").normalize("NFC").toLocaleLowerCase("th");
}

/** Keep the current unit's functional role first. Do not show redundant job-title lines. */
export function distinctEmploymentTitle(positionTitle: string, employmentPosition: string) {
  const role = normalizeLabel(positionTitle);
  const job = normalizeLabel(employmentPosition);
  return job && role !== job ? employmentPosition.trim() : "";
}
