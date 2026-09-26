import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import MergeOutlinedIcon from "@mui/icons-material/MergeOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/authSessionContext";
import { changeTaxonomy, getTaxonomySnapshot } from "../../features/cms-governance/gapClosureClient";
import { invalidateAdminListQueries } from "../../features/admin-pagination";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { appSwal } from "../../utils/swal";

const TAXONOMY_QUERY = ["cms-taxonomy-manager"] as const;

type TaxonomyKind = "category" | "tag";

export default function TaxonomyManagerPanel() {
  const queryClient = useQueryClient();
  const { hasCapability } = useAuth();
  const canUpdate = hasCapability("content.update");
  const [kind, setKind] = useState<TaxonomyKind>("category");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  const taxonomyQuery = useQuery({
    queryKey: TAXONOMY_QUERY,
    queryFn: getTaxonomySnapshot,
    staleTime: 10_000
  });
  const items = kind === "category" ? taxonomyQuery.data?.categories ?? [] : taxonomyQuery.data?.tags ?? [];
  const fromOption = useMemo(() => items.find((item) => item.label === from) ?? null, [from, items]);

  const mutation = useMutation({
    mutationFn: () => changeTaxonomy(kind, from, to),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TAXONOMY_QUERY }),
        invalidateAdminListQueries(queryClient, "content"),
        invalidatePublicCmsData(queryClient)
      ]);
    }
  });

  async function submitChange() {
    if (!from.trim()) {
      setError("กรุณาเลือกหมวดหมู่หรือแท็กต้นทาง");
      return;
    }
    const removing = !to.trim();
    const confirmation = await appSwal.fire({
      title: removing ? "ลบ taxonomy นี้ออกจากเนื้อหาทั้งหมด?" : "ยืนยันการเปลี่ยน taxonomy?",
      text: removing
        ? `ระบบจะนำ “${from}” ออกจากเนื้อหาที่เกี่ยวข้อง แต่จะไม่ลบเนื้อหา`
        : `“${from}” จะถูกรวม/เปลี่ยนชื่อเป็น “${to.trim()}” ในทุกเนื้อหาที่อยู่ในขอบเขตสิทธิ์`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: removing ? "ลบการอ้างอิง" : "ดำเนินการ",
      cancelButtonText: "ยกเลิก"
    });
    if (!confirmation.isConfirmed) return;

    setError("");
    try {
      const result = await mutation.mutateAsync();
      setFrom("");
      setTo("");
      await appSwal.fire({
        icon: "success",
        title: "อัปเดต taxonomy สำเร็จ",
        text: `ปรับปรุง ${result.affected} เนื้อหา`,
        confirmButtonText: "ตกลง"
      });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "ไม่สามารถอัปเดต taxonomy ได้");
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <AccountTreeOutlinedIcon color="primary" />
              <Typography variant="h2" sx={{ fontSize: "1.35rem" }}>
                จัดการหมวดหมู่และแท็ก
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              ดูจำนวนการใช้งาน เปลี่ยนชื่อ รวมคำซ้ำ หรือนำ taxonomy ที่เลิกใช้แล้วออกจากเนื้อหาแบบรวมศูนย์
            </Typography>
          </Box>

          {taxonomyQuery.data?.scope && (
            <Alert severity="info">บัญชีนี้ถูกจำกัดขอบเขตเนื้อหา: {taxonomyQuery.data.scope}</Alert>
          )}
          {taxonomyQuery.isError && <Alert severity="error">ไม่สามารถโหลด taxonomy ได้</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel id="taxonomy-kind-label">ชนิด</InputLabel>
                <Select
                  labelId="taxonomy-kind-label"
                  label="ชนิด"
                  value={kind}
                  onChange={(event) => {
                    setKind(event.target.value as TaxonomyKind);
                    setFrom("");
                    setTo("");
                  }}
                >
                  <MenuItem value="category">หมวดหมู่</MenuItem>
                  <MenuItem value="tag">แท็ก</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Autocomplete
                options={items}
                value={fromOption}
                onChange={(_, value) => setFrom(value?.label || "")}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.label === value.label}
                renderInput={(params) => <TextField {...params} label="ต้นทาง" placeholder="เลือกคำที่ต้องการจัดการ" />}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="ชื่อใหม่ / เป้าหมาย"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                helperText="เว้นว่างหากต้องการนำคำนี้ออก"
                fullWidth
              />
            </Grid>
          </Grid>

          <Box>
            <Button
              variant="contained"
              startIcon={<MergeOutlinedIcon />}
              disabled={!canUpdate || !from || mutation.isPending}
              onClick={() => void submitChange()}
            >
              {mutation.isPending ? "กำลังปรับปรุง" : "เปลี่ยนชื่อ / รวม taxonomy"}
            </Button>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {items.slice(0, 60).map((item) => (
              <Chip key={item.label} label={`${item.label} · ${item.count}`} variant="outlined" />
            ))}
            {!taxonomyQuery.isLoading && !items.length && <Typography color="text.secondary">ยังไม่มีข้อมูล</Typography>}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
