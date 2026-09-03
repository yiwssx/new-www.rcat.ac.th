import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Stack,
  Typography,
  type AlertProps,
  type ChipProps
} from "@mui/material";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import {
  getRuntimeIncidentFeed,
  type RuntimeIncidentFeed,
  type RuntimeIncidentItem,
  type RuntimeIncidentKind,
  type RuntimeIncidentSurface
} from "../../features/runtime-incidents/api";
import {
  runSystemHealthChecks,
  type SystemHealthCheck,
  type SystemHealthReport,
  type SystemHealthStatus
} from "../../features/system-health/api";

const GITHUB_ACTIONS_URL = "https://github.com/yiwssx/new-www.rcat.ac.th/actions";

const externalGuards = [
  {
    name: "Phase A — Production Browser QA",
    cadence: "หลัง CI + Vercel deployment สำเร็จ",
    detail: "Playwright ตรวจ production จริงทั้ง desktop/mobile และ runtime/console/network errors"
  },
  {
    name: "P6A — Production Observability",
    cadence: "ทุก 6 ชั่วโมง · approval-gated",
    detail: "ติดตาม D1 utilization ผ่าน Cloudflare Analytics โดยไม่ยิง SQL เข้า D1"
  },
  {
    name: "P6B — Security Enforcement",
    cadence: "ทุก 6 ชั่วโมง",
    detail: "ตรวจ security/WAF boundary ตาม production governance"
  },
  {
    name: "P6C — Recovery & Reliability",
    cadence: "ทุก 6 ชั่วโมง",
    detail: "ตรวจเส้นทาง SSR → Worker → D1 แบบ bounded read-only reliability probe"
  }
] as const;

function statusLabel(status: SystemHealthStatus) {
  if (status === "healthy") return "ปกติ";
  if (status === "warning") return "ควรตรวจสอบ";
  if (status === "error") return "ผิดปกติ";
  return "ไม่ตรวจอัตโนมัติ";
}

function statusColor(status: SystemHealthStatus): ChipProps["color"] {
  if (status === "healthy") return "success";
  if (status === "warning") return "warning";
  if (status === "error") return "error";
  return "default";
}

function overallSeverity(status: SystemHealthReport["overallStatus"]): AlertProps["severity"] {
  if (status === "healthy") return "success";
  if (status === "warning") return "warning";
  return "error";
}

function overallMessage(status: SystemHealthReport["overallStatus"]) {
  if (status === "healthy") {
    return "เส้นทางหลักที่ตรวจได้จากเบราว์เซอร์ตอบกลับปกติ";
  }

  if (status === "warning") {
    return "ระบบหลักยังตอบกลับ แต่มีสัญญาณที่ควรตรวจสอบเพิ่มเติม";
  }

  return "พบเส้นทางระบบหลักอย่างน้อยหนึ่งรายการที่ผิดปกติ กรุณาดูรายละเอียดและ Request ID";
}

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(value));
}

function incidentKindLabel(kind: RuntimeIncidentKind) {
  if (kind === "runtime_error") return "Runtime error";
  if (kind === "unhandled_rejection") return "Unhandled rejection";
  return "API failure";
}

function incidentSurfaceLabel(surface: RuntimeIncidentSurface) {
  if (surface === "admin") return "Admin";
  if (surface === "auth") return "Authentication";
  if (surface === "public") return "Public";
  return "Unknown";
}

function HealthCheckCard({ check }: { check: SystemHealthCheck }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h3" sx={{ fontSize: "1rem" }}>
                {check.label}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {check.description}
              </Typography>
            </Box>
            <Chip
              label={statusLabel(check.status)}
              color={statusColor(check.status)}
              size="small"
              variant={check.status === "unknown" ? "outlined" : "filled"}
            />
          </Stack>

          <Divider />

          <Typography variant="body2">{check.detail}</Typography>

          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
            {check.httpStatus !== undefined && (
              <Typography variant="caption" color="text.secondary">
                HTTP {check.httpStatus}
              </Typography>
            )}
            {check.latencyMs !== undefined && (
              <Typography variant="caption" color="text.secondary">
                {check.latencyMs} ms
              </Typography>
            )}
          </Stack>

          {check.requestId && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Request ID
              </Typography>
              <Typography
                component="code"
                variant="body2"
                sx={{ display: "block", mt: 0.5, overflowWrap: "anywhere", fontFamily: "monospace" }}
              >
                {check.requestId}
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function RuntimeIncidentRow({ incident }: { incident: RuntimeIncidentItem }) {
  return (
    <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Chip label={incidentKindLabel(incident.kind)} size="small" color="warning" variant="outlined" />
          <Chip label={incidentSurfaceLabel(incident.surface)} size="small" variant="outlined" />
          <Chip label={`${incident.occurrenceCount} ครั้ง`} size="small" />
          {incident.httpStatus !== undefined && <Chip label={`HTTP ${incident.httpStatus}`} size="small" color="error" />}
        </Stack>

        <Typography component="code" variant="body2" sx={{ overflowWrap: "anywhere", fontFamily: "monospace" }}>
          {incident.pathname}
        </Typography>

        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Typography variant="caption" color="text.secondary">
            {incident.errorName}
          </Typography>
          {incident.apiMethod && (
            <Typography variant="caption" color="text.secondary">
              {incident.apiMethod}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            ล่าสุด {formatCheckedAt(incident.lastSeenAt)}
          </Typography>
        </Stack>

        {incident.requestId && (
          <Typography component="code" variant="caption" sx={{ overflowWrap: "anywhere", fontFamily: "monospace" }}>
            Request ID: {incident.requestId}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function RuntimeIncidentFeedCard({ feed, error }: { feed: RuntimeIncidentFeed | null; error: boolean }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h2">Runtime Incident Feed · B2</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              รวมเฉพาะ uncaught runtime errors, unhandled promise rejections และ API 5xx/network failures แบบ privacy-safe
            </Typography>
          </Box>

          <Alert severity="info">
            ไม่เก็บ error message, stack trace, request/response body, query string, cookie, token, IP, email หรือ User-Agent ·
            เก็บเหตุการณ์ไม่เกิน 7 วัน และรวมเหตุซ้ำเป็นช่วงเวลา 5 นาที
          </Alert>

          {error ? (
            <Alert severity="warning">ไม่สามารถอ่าน Runtime Incident Feed ได้ในขณะนี้ โดย health checks อื่นยังทำงานแยกตามปกติ</Alert>
          ) : feed && feed.items.length === 0 ? (
            <Alert severity="success">ไม่พบ runtime incident ในช่วง {feed.windowHours} ชั่วโมงล่าสุด</Alert>
          ) : feed ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                แสดง {feed.items.length} กลุ่มเหตุการณ์ล่าสุดในช่วง {feed.windowHours} ชั่วโมง · อัปเดตเมื่อกดตรวจสอบระบบ
              </Typography>
              {feed.items.map((incident) => (
                <RuntimeIncidentRow key={incident.id} incident={incident} />
              ))}
            </Stack>
          ) : (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <CircularProgress size={20} />
              <Typography variant="body2">กำลังอ่าน Runtime Incident Feed...</Typography>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function SystemHealthPage() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [incidentFeed, setIncidentFeed] = useState<RuntimeIncidentFeed | null>(null);
  const [incidentFeedError, setIncidentFeedError] = useState(false);
  const [loading, setLoading] = useState(false);
  const initialRunStarted = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setIncidentFeedError(false);

    try {
      const [healthResult, incidentResult] = await Promise.allSettled([
        runSystemHealthChecks(),
        getRuntimeIncidentFeed({ hours: 24, limit: 25 })
      ]);

      if (healthResult.status === "fulfilled") {
        setReport(healthResult.value);
      }

      if (incidentResult.status === "fulfilled") {
        setIncidentFeed(incidentResult.value);
      } else {
        setIncidentFeedError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRunStarted.current) return;
    initialRunStarted.current = true;
    void refresh();
  }, [refresh]);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <DashboardOutlinedIcon color="primary" />
            <Typography variant="h1">สถานะระบบ</Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            ตรวจเส้นทางสำคัญแบบ read-only จาก Admin โดยใช้ boundary และ Request ID ที่ระบบมีอยู่แล้ว
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress color="inherit" size={18} /> : <CloudSyncOutlinedIcon />}
          disabled={loading}
          onClick={() => void refresh()}
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          {loading ? "กำลังตรวจสอบ" : "ตรวจสอบอีกครั้ง"}
        </Button>
      </Stack>

      <Alert severity="info">
        หน้านี้ไม่สร้าง แก้ไข ลบ หรือ publish ข้อมูล และไม่ยิง Facebook thumbnail/import เพื่อใช้เป็น health check
      </Alert>

      {report ? (
        <>
          <Alert severity={overallSeverity(report.overallStatus)}>
            {overallMessage(report.overallStatus)} · ตรวจล่าสุด {formatCheckedAt(report.checkedAt)}
          </Alert>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              gap: 2
            }}
          >
            {report.checks.map((check) => (
              <HealthCheckCard key={check.id} check={check} />
            ))}
          </Box>
        </>
      ) : (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <CircularProgress size={22} />
              <Typography>กำลังตรวจสอบเส้นทางระบบหลัก...</Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      <RuntimeIncidentFeedCard feed={incidentFeed} error={incidentFeedError} />

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h2">Operational guards ที่มีอยู่แล้ว</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Phase B ไม่สร้าง monitoring stack ซ้ำ สถานะต่อไปนี้ยังมี owner อยู่ใน GitHub Actions ตาม governance เดิม
              </Typography>
            </Box>

            <Divider />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
                gap: 2
              }}
            >
              {externalGuards.map((guard) => (
                <Box key={guard.name} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Stack spacing={0.75}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {guard.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {guard.cadence}
                    </Typography>
                    <Typography variant="body2">{guard.detail}</Typography>
                  </Stack>
                </Box>
              ))}
            </Box>

            <Typography variant="body2" color="text.secondary">
              ดูผล workflow ล่าสุดได้ที่{" "}
              <Link href={GITHUB_ACTIONS_URL} target="_blank" rel="noreferrer">
                GitHub Actions
              </Link>
              . การรวมผล workflow ล่าสุดเข้าหน้านี้โดยไม่ใช้ token ฝั่ง browser เป็นขอบเขต B3
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
