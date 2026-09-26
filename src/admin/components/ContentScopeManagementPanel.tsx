import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/authSessionContext";
import { getContentScopes, updateContentScope } from "../../features/cms-governance/gapClosureClient";
import { appSwal } from "../../utils/swal";

const CONTENT_SCOPE_QUERY = ["cms-content-scopes"] as const;

export default function ContentScopeManagementPanel() {
  const queryClient = useQueryClient();
  const { session, hasCapability } = useAuth();
  const canManage = session?.user.role === "admin" && hasCapability("users.update-any");
  const canRead = session?.user.role === "admin" && hasCapability("users.read-all");
  const [selectedId, setSelectedId] = useState("");
  const [contentScope, setContentScope] = useState("");
  const [error, setError] = useState("");

  const scopesQuery = useQuery({
    queryKey: CONTENT_SCOPE_QUERY,
    queryFn: getContentScopes,
    enabled: canRead,
    staleTime: 10_000
  });
  const editors = useMemo(
    () => (scopesQuery.data?.items ?? []).filter((item) => item.role === "editor"),
    [scopesQuery.data?.items]
  );
  const selected = editors.find((item) => item.id === selectedId) ?? null;

  const mutation = useMutation({
    mutationFn: () => updateContentScope(selectedId, contentScope.trim()),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: CONTENT_SCOPE_QUERY })
  });

  if (!canRead) return null;

  async function saveScope() {
    if (!selectedId) return;
    setError("");
    try {
      const result = await mutation.mutateAsync();
      await appSwal.fire({
        icon: "success",
        title: "บันทึกขอบเขตเนื้อหาแล้ว",
        text: result.contentScope
          ? `Editor รายนี้แก้ไขได้เฉพาะเนื้อหาที่ owner ตรงกับ “${result.contentScope}”`
          : "Editor รายนี้กลับมาใช้ขอบเขตแบบเดิม (ไม่จำกัด owner)",
        confirmButtonText: "ตกลง"
      });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "ไม่สามารถบันทึกขอบเขตเนื้อหาได้");
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <AdminPanelSettingsOutlinedIcon color="primary" />
              <Typography variant="h2" sx={{ fontSize: "1.35rem" }}>
                ขอบเขตเนื้อหาของ Editor
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              จำกัดการสร้าง แก้ไข เผยแพร่ ลบ Workflow และกู้คืนเนื้อหาตามค่า owner โดยไม่ต้องสร้าง Role ใหม่จำนวนมาก
            </Typography>
          </Box>

          <Alert severity="info">
            เป็นระบบ opt-in: ช่องว่างหมายถึงพฤติกรรมเดิมและไม่จำกัด owner เพื่อไม่กระทบบัญชี Editor ที่ใช้งานอยู่
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {scopesQuery.isError && <Alert severity="error">ไม่สามารถโหลดข้อมูลขอบเขตผู้ใช้ได้</Alert>}

          <Autocomplete
            options={editors}
            value={selected}
            onChange={(_, value) => {
              setSelectedId(value?.id || "");
              setContentScope(value?.contentScope || "");
              setError("");
            }}
            getOptionLabel={(option) => `${option.name || option.email} · ${option.email}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", width: "100%" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap>{option.name || option.email}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {option.email}
                    </Typography>
                  </Box>
                  {option.contentScope && <Chip label={option.contentScope} size="small" variant="outlined" />}
                </Stack>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label="เลือก Editor" placeholder="ค้นหาชื่อหรืออีเมล" />}
          />

          <TextField
            label="Content owner scope"
            value={contentScope}
            onChange={(event) => setContentScope(event.target.value)}
            placeholder="เช่น แผนกวิชาบริหารธุรกิจ"
            helperText="ต้องตรงกับค่า owner ของเนื้อหา; เว้นว่างเพื่อไม่จำกัดขอบเขต"
            disabled={!selectedId || !canManage || mutation.isPending}
            fullWidth
          />

          <Box>
            <Button
              variant="contained"
              startIcon={<SaveOutlinedIcon />}
              disabled={!selectedId || !canManage || mutation.isPending}
              onClick={() => void saveScope()}
            >
              {mutation.isPending ? "กำลังบันทึก" : "บันทึกขอบเขต"}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
