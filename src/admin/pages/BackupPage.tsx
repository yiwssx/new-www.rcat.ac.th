import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import BackupOutlinedIcon from "@mui/icons-material/BackupOutlined";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../../context/authSessionContext";
import {
  downloadD1BackupFromCloudflare,
  getD1BackupCountsFromCloudflare,
  type AdminBackupCounts,
  type AdminBackupDownload,
  type AdminBackupTableCount
} from "../../features/admin-write/cloudflareApi";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { canManageSystemBackup } from "../utils/rbac";

function triggerBackupDownload(download: AdminBackupDownload) {
  const url = URL.createObjectURL(download.blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = download.filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatGeneratedAt(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  });
}

function getStatusColor(status: AdminBackupTableCount["status"]) {
  if (status === "ok") {
    return "success" as const;
  }

  if (status === "missing") {
    return "warning" as const;
  }

  return "error" as const;
}

export default function BackupPage() {
  const { session } = useAuth();
  const canManage = canManageSystemBackup(session?.user);
  const [counts, setCounts] = useState<AdminBackupCounts | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheckCounts() {
    if (!canManage) {
      return;
    }

    setError("");
    setIsChecking(true);

    try {
      setCounts(await getD1BackupCountsFromCloudflare());
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : "ไม่สามารถตรวจนับข้อมูลได้";
      setError(message);
      await showErrorResult("ไม่สามารถตรวจนับข้อมูลได้", currentError, "กรุณาลองอีกครั้ง");
    } finally {
      setIsChecking(false);
    }
  }

  async function handleDownloadBackup() {
    if (!canManage) {
      return;
    }

    const result = await appSwal.fire({
      title: "ต้องการสร้างและดาวน์โหลดไฟล์สำรองข้อมูลระบบหรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ดาวน์โหลด",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    setError("");
    setIsDownloading(true);
    showBlockingLoading("กำลังสร้างไฟล์สำรองข้อมูล");

    try {
      const download = await downloadD1BackupFromCloudflare();
      triggerBackupDownload(download);
      await appSwal.close();
      await showSuccessResult("ดาวน์โหลดไฟล์สำรองข้อมูลสำเร็จ");
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : "ไม่สามารถสร้างไฟล์สำรองข้อมูลได้";
      setError(message);
      await appSwal.close();
      await showErrorResult("ไม่สามารถสร้างไฟล์สำรองข้อมูลได้", currentError, "กรุณาลองอีกครั้ง");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Box>
      <PageHeader
        title="สำรองข้อมูลระบบ"
        description="สร้างไฟล์สำรองข้อมูล D1 แบบ JSON จากข้อมูลระบบที่ใช้กับเว็บไซต์และ CMS"
      />

      <Stack spacing={2.5}>
        <Alert severity="warning" icon={<WarningAmberOutlinedIcon />}>
          ไฟล์สำรองข้อมูลอาจมีข้อมูลระบบและข้อมูลผู้ดูแล ควรจัดเก็บไว้ในพื้นที่ปลอดภัย และห้ามเผยแพร่สาธารณะ
        </Alert>

        {!canManage && <Alert severity="info">บัญชีนี้ไม่มีสิทธิ์สร้างหรือดาวน์โหลดไฟล์สำรองข้อมูลระบบ</Alert>}

        {error && <Alert severity="error">{error}</Alert>}

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 1.5 }}>
                  <StorageOutlinedIcon color="primary" />
                  <Typography variant="h3">สถานะข้อมูล</Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  ตรวจนับจำนวนแถวของตารางสำคัญก่อนสร้างไฟล์สำรองข้อมูล
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<FactCheckOutlinedIcon />}
                  disabled={!canManage || isChecking || isDownloading}
                  onClick={() => void handleCheckCounts()}
                  sx={{ mb: 2 }}
                >
                  {isChecking ? "กำลังตรวจนับข้อมูล" : "ตรวจนับข้อมูล"}
                </Button>
                {isChecking && <LinearProgress sx={{ mb: 2 }} />}
                {counts && (
                  <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                      ตรวจนับล่าสุด: {formatGeneratedAt(counts.generatedAt)}
                    </Typography>
                    <TableContainer>
                      <Table size="small" aria-label="ตารางตรวจนับข้อมูลสำรอง">
                        <TableHead>
                          <TableRow>
                            <TableCell>table name</TableCell>
                            <TableCell align="right">row count</TableCell>
                            <TableCell>status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {counts.tables.map((table) => (
                            <TableRow key={table.name}>
                              <TableCell>{table.name}</TableCell>
                              <TableCell align="right">{table.rowCount}</TableCell>
                              <TableCell>
                                <Stack spacing={0.5} alignItems="flex-start">
                                  <Chip
                                    color={getStatusColor(table.status)}
                                    label={table.status}
                                    size="small"
                                    variant={table.status === "ok" ? "filled" : "outlined"}
                                  />
                                  {table.message && (
                                    <Typography color="text.secondary" variant="caption">
                                      {table.message}
                                    </Typography>
                                  )}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 1.5 }}>
                  <BackupOutlinedIcon color="primary" />
                  <Typography variant="h3">สำรองข้อมูล</Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  ดาวน์โหลดไฟล์ JSON ที่รวมข้อมูลจากตารางหลักของ Cloudflare D1
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CloudDownloadOutlinedIcon />}
                  disabled={!canManage || isDownloading || isChecking}
                  onClick={() => void handleDownloadBackup()}
                >
                  {isDownloading ? "กำลังสร้างไฟล์สำรองข้อมูล" : "ดาวน์โหลดไฟล์สำรองข้อมูล"}
                </Button>
                <Alert severity="info" sx={{ mt: 2 }}>
                  การกู้คืนข้อมูลยังไม่เปิดให้ทำผ่านหน้าเว็บ เพื่อป้องกันการเขียนทับข้อมูลโดยไม่ตั้งใจ
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
