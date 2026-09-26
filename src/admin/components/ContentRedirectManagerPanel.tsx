import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddLinkOutlinedIcon from "@mui/icons-material/AddLinkOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import RedoOutlinedIcon from "@mui/icons-material/RedoOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/authSessionContext";
import {
  deleteContentRedirect,
  getContentRedirects,
  saveContentRedirect
} from "../../features/cms-governance/gapClosureClient";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { formatDisplayDateTime } from "../../utils/dateDisplay";
import { appSwal } from "../../utils/swal";

const REDIRECT_QUERY = ["cms-content-redirects"] as const;

export default function ContentRedirectManagerPanel() {
  const queryClient = useQueryClient();
  const { session, hasCapability } = useAuth();
  const isAdmin = session?.user.role === "admin";
  const canUpdate = isAdmin && hasCapability("content.update");
  const [oldSlug, setOldSlug] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [error, setError] = useState("");

  const redirectsQuery = useQuery({
    queryKey: REDIRECT_QUERY,
    queryFn: getContentRedirects,
    staleTime: 10_000
  });

  const saveMutation = useMutation({
    mutationFn: () => saveContentRedirect(oldSlug.trim(), newSlug.trim()),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: REDIRECT_QUERY }), invalidatePublicCmsData(queryClient)]);
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (slug: string) => deleteContentRedirect(slug),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: REDIRECT_QUERY }), invalidatePublicCmsData(queryClient)]);
    }
  });

  async function saveRedirect() {
    if (!oldSlug.trim() || !newSlug.trim()) {
      setError("กรุณาระบุ slug เดิมและ slug ปลายทาง");
      return;
    }
    setError("");
    try {
      await saveMutation.mutateAsync();
      setOldSlug("");
      setNewSlug("");
      await appSwal.fire({ icon: "success", title: "บันทึก Redirect แล้ว", confirmButtonText: "ตกลง" });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "ไม่สามารถบันทึก Redirect ได้");
    }
  }

  async function removeRedirect(slug: string) {
    const confirm = await appSwal.fire({
      title: "ลบ Redirect นี้?",
      text: `ลิงก์เก่า /content/${slug} จะไม่ถูกส่งต่อโดยรายการนี้อีก`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก"
    });
    if (!confirm.isConfirmed) return;
    try {
      await deleteMutation.mutateAsync(slug);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "ไม่สามารถลบ Redirect ได้");
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <RedoOutlinedIcon color="primary" />
              <Typography variant="h2" sx={{ fontSize: "1.35rem" }}>
                Redirect และประวัติ Slug
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              เมื่อเปลี่ยน slug ระบบจะเก็บเส้นทางเดิมให้อัตโนมัติและส่งผู้เข้าชมไปยัง canonical URL ล่าสุดแบบถาวร
            </Typography>
          </Box>

          {redirectsQuery.isError && <Alert severity="error">ไม่สามารถโหลดรายการ Redirect ได้</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          {canUpdate && (
            <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
              <Grid size={{ xs: 12, md: 5 }}>
                <TextField
                  label="Slug เดิม"
                  value={oldSlug}
                  onChange={(event) => setOldSlug(event.target.value)}
                  placeholder="ข่าวเดิม"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <TextField
                  label="Slug ปลายทาง"
                  value={newSlug}
                  onChange={(event) => setNewSlug(event.target.value)}
                  placeholder="ข่าวใหม่"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<AddLinkOutlinedIcon />}
                  disabled={saveMutation.isPending || !oldSlug.trim() || !newSlug.trim()}
                  onClick={() => void saveRedirect()}
                  fullWidth
                >
                  เพิ่ม
                </Button>
              </Grid>
            </Grid>
          )}

          {!isAdmin && (
            <Alert severity="info">บัญชี Editor/Viewer ดูประวัติ Redirect ได้ แต่การสร้างหรือลบรายการกำหนดให้ Admin เท่านั้น</Alert>
          )}

          <Stack divider={<Divider flexItem />} spacing={0}>
            {redirectsQuery.data?.items.map((item) => (
              <Stack
                key={item.old_slug}
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                sx={{ py: 1.25, alignItems: { md: "center" }, justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
                    /content/{item.old_slug} → /content/{item.new_slug}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    อัปเดต {formatDisplayDateTime(item.updated_at) || item.updated_at}
                  </Typography>
                </Box>
                {canUpdate && (
                  <Tooltip title="ลบ Redirect">
                    <IconButton
                      color="error"
                      aria-label={`ลบ redirect ${item.old_slug}`}
                      disabled={deleteMutation.isPending}
                      onClick={() => void removeRedirect(item.old_slug)}
                    >
                      <DeleteOutlineOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            ))}
            {!redirectsQuery.isLoading && !redirectsQuery.data?.items.length && (
              <Typography sx={{ py: 1.5, color: "text.secondary" }}>ยังไม่มีประวัติ Redirect</Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
