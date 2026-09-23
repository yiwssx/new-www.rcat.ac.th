import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AccessibilityNewOutlinedIcon from "@mui/icons-material/AccessibilityNewOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/authSessionContext";
import { getAdminCmsSnapshotFromCloudflare } from "../../features/admin-write/cloudflareApi";
import { getMediaUsage, updateMediaAltText } from "../../features/cms-governance/client";
import { invalidateAdminListQueries } from "../../features/admin-pagination";
import type { MediaAsset } from "../../types";
import { appSwal } from "../../utils/swal";

const MEDIA_OPTIONS_QUERY = ["cms-governance", "media-options"] as const;

function mediaIdentity(asset: MediaAsset) {
  return String(asset.fileId || asset.driveUrl || "").trim();
}

export default function MediaUsageGovernancePanel() {
  const queryClient = useQueryClient();
  const { hasCapability } = useAuth();
  const canManage = hasCapability("media.manage");
  const [selectedId, setSelectedId] = useState("");
  const [altText, setAltText] = useState("");
  const [error, setError] = useState("");

  const optionsQuery = useQuery({
    queryKey: MEDIA_OPTIONS_QUERY,
    queryFn: getAdminCmsSnapshotFromCloudflare,
    staleTime: 30_000
  });
  const options = useMemo(
    () => [...(optionsQuery.data?.media ?? [])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [optionsQuery.data?.media]
  );
  const selected = options.find((asset) => asset.id === selectedId) ?? null;
  const selectedIdentity = selected ? mediaIdentity(selected) : "";
  const duplicates = selectedIdentity
    ? options.filter((asset) => asset.id !== selectedId && mediaIdentity(asset) === selectedIdentity)
    : [];

  const usageQuery = useQuery({
    queryKey: ["cms-governance", "media-usage", selectedId],
    queryFn: () => getMediaUsage(selectedId),
    enabled: Boolean(selectedId),
    staleTime: 5_000
  });

  const altMutation = useMutation({
    mutationFn: () => updateMediaAltText(selectedId, altText),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cms-governance", "media-usage", selectedId] }),
        queryClient.invalidateQueries({ queryKey: MEDIA_OPTIONS_QUERY }),
        invalidateAdminListQueries(queryClient, "media")
      ]);
    }
  });

  async function selectMedia(asset: MediaAsset | null) {
    setSelectedId(asset?.id || "");
    setError("");
    if (!asset) {
      setAltText("");
      return;
    }
    try {
      const usage = await queryClient.fetchQuery({
        queryKey: ["cms-governance", "media-usage", asset.id],
        queryFn: () => getMediaUsage(asset.id),
        staleTime: 0
      });
      setAltText(usage.altText || "");
    } catch (currentError) {
      setAltText("");
      setError(currentError instanceof Error ? currentError.message : "ไม่สามารถโหลดข้อมูลการใช้งานสื่อได้");
    }
  }

  async function saveAltText() {
    setError("");
    try {
      await altMutation.mutateAsync();
      await appSwal.fire({
        icon: "success",
        title: "บันทึกคำอธิบายรูปภาพแล้ว",
        confirmButtonText: "ตกลง"
      });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "ไม่สามารถบันทึกคำอธิบายรูปภาพได้");
    }
  }

  const usage = usageQuery.data;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: "1.35rem" }}>
              การใช้งานและคุณภาพสื่อ
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              ตรวจว่าไฟล์ถูกใช้อยู่ที่ไหน หาไฟล์ที่ไม่ถูกใช้งาน ตรวจไฟล์ซ้ำ และจัดการ alt text สำหรับ accessibility
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <Autocomplete
            options={options}
            value={selected}
            onChange={(_, value) => void selectMedia(value)}
            getOptionLabel={(option) => `${option.name} · ${option.type}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="เลือกสื่อ" placeholder="ค้นหาชื่อไฟล์" />}
          />
          {usageQuery.isLoading && selectedId && <Typography>กำลังตรวจการใช้งาน…</Typography>}
          {usageQuery.isError && <Alert severity="warning">ไม่สามารถตรวจการใช้งานสื่อนี้ได้</Alert>}
          {usage && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Chip
                  color={usage.count ? "primary" : "success"}
                  label={usage.count ? `ถูกใช้ ${usage.count} จุด` : "Orphan · ยังไม่ถูกใช้งาน"}
                />
                {duplicates.length > 0 && <Chip color="warning" label={`พบไฟล์ซ้ำ ${duplicates.length} รายการ`} />}
              </Stack>

              {usage.items.length > 0 && (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {usage.items.map((item) => (
                    <Stack key={`${item.entityType}:${item.id}`} direction="row" spacing={1} sx={{ py: 1 }}>
                      <LinkOutlinedIcon color="action" fontSize="small" />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {item.entityType} · {item.detail}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              )}

              {duplicates.length > 0 && (
                <Alert severity="warning">
                  ไฟล์นี้มี file ID หรือ Drive URL ซ้ำกับ: {duplicates.map((asset) => asset.name).join(", ")}
                </Alert>
              )}

              {selected?.type === "image" && (
                <Stack spacing={1.25}>
                  <TextField
                    label="Alt text"
                    value={altText}
                    onChange={(event) => setAltText(event.target.value)}
                    helperText="อธิบายสาระสำคัญของภาพแบบกระชับ หากภาพเป็นเพียงตกแต่งสามารถเว้นว่างได้"
                    inputProps={{ maxLength: 500 }}
                    fullWidth
                    multiline
                    minRows={2}
                    disabled={!canManage || altMutation.isPending}
                  />
                  {canManage && (
                    <Box>
                      <Button
                        variant="outlined"
                        startIcon={<AccessibilityNewOutlinedIcon />}
                        disabled={altMutation.isPending}
                        onClick={() => void saveAltText()}
                      >
                        บันทึก Alt text
                      </Button>
                    </Box>
                  )}
                </Stack>
              )}

              {usage.count > 0 && canManage && (
                <Alert severity="info">
                  ระบบจะปฏิเสธการลบไฟล์นี้จนกว่าจะนำ reference ทั้งหมดออกจากเนื้อหา เอกสาร หรือกิจกรรมที่เกี่ยวข้อง
                </Alert>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
