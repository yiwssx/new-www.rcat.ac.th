import { ChangeEvent, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import RestorePageOutlinedIcon from "@mui/icons-material/RestorePageOutlined";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/authSessionContext";
import { recoverD1Backup } from "../../features/cms-governance/gapClosureClient";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { appSwal } from "../../utils/swal";

const MAX_BACKUP_FILE_BYTES = 16 * 1024 * 1024;

type BackupPayload = {
  schemaVersion: number;
  generatedAt?: string;
  environment?: string;
  tables: Record<string, { rowCount?: number; rows?: unknown[] }>;
};

function parseBackupPayload(value: unknown): BackupPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<BackupPayload>;
  if (![1, 2].includes(Number(candidate.schemaVersion))) return null;
  if (!candidate.tables || typeof candidate.tables !== "object" || Array.isArray(candidate.tables)) return null;
  return candidate as BackupPayload;
}

export default function PortableBackupRecoveryPanel() {
  const queryClient = useQueryClient();
  const { hasCapability } = useAuth();
  const canRecover = hasCapability("backup.restore");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const rowCount = useMemo(
    () =>
      payload
        ? Object.values(payload.tables).reduce((total, table) => {
            const rows = Array.isArray(table?.rows) ? table.rows.length : Number(table?.rowCount || 0);
            return total + Math.max(0, Number.isFinite(rows) ? rows : 0);
          }, 0)
        : 0,
    [payload]
  );

  const mutation = useMutation({
    mutationFn: () => recoverD1Backup(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(),
        invalidatePublicCmsData(queryClient)
      ]);
    }
  });

  if (!canRecover) return null;

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setPayload(null);
    setFileName("");
    setError("");
    if (!file) return;
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setError("ไฟล์สำรองข้อมูลมีขนาดเกิน 16 MB");
      return;
    }
    try {
      const parsed = parseBackupPayload(JSON.parse(await file.text()));
      if (!parsed) throw new Error("รูปแบบไฟล์สำรองข้อมูลไม่รองรับ");
      setPayload(parsed);
      setFileName(file.name);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "ไม่สามารถอ่านไฟล์สำรองข้อมูลได้");
    }
  }

  async function recover() {
    if (!payload) return;
    const confirmation = await appSwal.fire({
      title: "ยืนยันการกู้คืนแบบ Merge?",
      html: `ไฟล์ <b>${fileName}</b><br/>ระบบจะ upsert ข้อมูล CMS ที่อยู่ในไฟล์โดยไม่ล้างฐานข้อมูล และจะไม่แตะตารางบัญชี รหัสผ่าน MFA หรือ Session`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันการกู้คืน",
      cancelButtonText: "ยกเลิก"
    });
    if (!confirmation.isConfirmed) return;

    setError("");
    try {
      const result = await mutation.mutateAsync();
      setPayload(null);
      setFileName("");
      await appSwal.fire({
        icon: "success",
        title: "กู้คืนข้อมูลสำเร็จ",
        text: `ประมวลผล ${result.restoredRows} แถว · schema v${result.schemaVersion}`,
        confirmButtonText: "ตกลง"
      });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "ไม่สามารถกู้คืนข้อมูลได้");
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <RestorePageOutlinedIcon color="warning" />
              <Typography variant="h3">กู้คืนข้อมูลแบบ Portable Merge</Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              รองรับไฟล์ schema v1/v2 ตรวจคอลัมน์กับ D1 ก่อนเขียน และต้องยืนยัน MFA ล่าสุดก่อนดำเนินการ
            </Typography>
          </Box>

          <Alert severity="warning">
            ฟังก์ชันนี้ไม่ใช่ Full Replace: ข้อมูลในไฟล์จะถูก upsert เฉพาะตาราง CMS ที่อนุญาต เพื่อหลีกเลี่ยงการล้างข้อมูลหรือเขียนทับระบบยืนยันตัวตนโดยไม่ตั้งใจ
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}

          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void selectFile(event)}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ alignItems: { sm: "center" } }}>
            <Button
              variant="outlined"
              startIcon={<CloudUploadOutlinedIcon />}
              disabled={mutation.isPending}
              onClick={() => inputRef.current?.click()}
            >
              เลือกไฟล์ JSON
            </Button>
            {payload && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Chip label={fileName} />
                <Chip label={`schema v${payload.schemaVersion}`} variant="outlined" />
                <Chip label={`${Object.keys(payload.tables).length} tables`} variant="outlined" />
                <Chip label={`ประมาณ ${rowCount} rows`} variant="outlined" />
              </Stack>
            )}
          </Stack>

          <Box>
            <Button
              variant="contained"
              color="warning"
              startIcon={<RestorePageOutlinedIcon />}
              disabled={!payload || mutation.isPending}
              onClick={() => void recover()}
            >
              {mutation.isPending ? "กำลังกู้คืนข้อมูล" : "กู้คืนแบบ Merge"}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
