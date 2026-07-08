# Admin Backup Runbook

M21 adds a one-click logical JSON backup for Cloudflare D1 data from the CMS admin area.

## Open The Backup Page

1. Sign in to the CMS as an admin-level user.
2. Open **Admin > สำรองข้อมูล**.
3. Confirm the page title is **สำรองข้อมูลระบบ**.

Editor and viewer accounts can see the page but cannot run count or download actions.

## Check Counts

1. Click **ตรวจนับข้อมูล**.
2. Review the table list, row count, status, and generated time.
3. If a table shows `missing`, confirm whether that table is optional in the current environment before relying on the backup.

## Download Backup

1. Click **ดาวน์โหลดไฟล์สำรองข้อมูล**.
2. Confirm the prompt: `ต้องการสร้างและดาวน์โหลดไฟล์สำรองข้อมูลระบบหรือไม่`.
3. Wait for `กำลังสร้างไฟล์สำรองข้อมูล`.
4. Confirm the downloaded `.json` file opens and contains `schemaVersion`, `generatedAt`, `counts`, and `tables`.

The file name follows `rcat-d1-backup-<environment>-<timestamp>.json`.

## Safe Storage

Backup files may include system data and admin metadata. Store them outside the repository in a restricted location such as an encrypted drive, approved password manager attachment vault, or organization-controlled private storage.

Do not upload backup files to public websites, public Drive folders, chat channels, source control, or issue trackers.

## Frequency

Recommended baseline:

- Before each Worker or D1-affecting deployment.
- Before bulk content/admin-data changes.
- Weekly during active CMS operation.
- Immediately before any future restore/import procedure.

## Restore Status

Restore/import is not available in the Admin UI. Recovery remains a manual operator procedure until a separate destructive-write design is approved and tested.
