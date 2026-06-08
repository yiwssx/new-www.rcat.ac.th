# Public Document Parity Fixtures

These fixtures are fake, sanitized contract examples for M3.1 parity tests. They are not live Apps Script output and they are not production data.

## Files

- `appsScriptSnapshot.sample.json` is shaped like the existing Apps Script `PublicDocumentListSnapshot` response.
- `d1Rows.sample.json` is shaped like Worker-local D1 `DocumentRow` records that map exactly to the Apps Script-style fixture.

## Manual Comparison Notes

If you manually capture a live Apps Script `public-document-list` response for local comparison, keep it outside git unless it is fully sanitized:

- replace every real URL with an `example.test` URL
- remove any real school, Google Drive, or Apps Script data
- keep only the public contract fields
- do not add `sampleOnly` to Apps Script-shaped committed fixtures

Do not add scripts that call production Apps Script automatically. Unit tests must use committed fake fixtures only.
