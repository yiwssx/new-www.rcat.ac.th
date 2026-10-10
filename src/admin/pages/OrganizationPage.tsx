import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import { useAuth } from "../../context/authSessionContext";
import { hasCmsCapability } from "../../features/cms-auth";
import { organizationCollectionQueryOptions } from "../../features/organization-admin";

/**
 * Phase 3: a capability-gated entry point and read-only API integration.
 * Editors, personnel management, and builder controls arrive in Phases 4–6.
 */
export default function OrganizationPage() {
  const { capabilities } = useAuth();
  const canManage = hasCmsCapability(capabilities, "organization.manage");
  const units = useQuery(organizationCollectionQueryOptions("units"));
  const personnel = useQuery(organizationCollectionQueryOptions("personnel"));
  const positions = useQuery(organizationCollectionQueryOptions("positions"));
  const assignments = useQuery(organizationCollectionQueryOptions("assignments"));
  const collections = [
    { label: "หน่วยงาน", query: units },
    { label: "บุคลากร", query: personnel },
    { label: "ตำแหน่ง", query: positions },
    { label: "การมอบหมายหน้าที่", query: assignments }
  ];

  return (
    <Stack spacing={3} sx={{ width: "100%", minWidth: 0 }}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AccountTreeOutlinedIcon color="primary" />
          <Typography variant="h1" sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }}>
            ผังองค์กร
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          ระบบข้อมูลหน่วยงาน บุคลากร ตำแหน่ง และหน้าที่ แยกจากการจัดการเนื้อหาทั่วไป
        </Typography>
      </Box>
      <Alert severity="info">
        {canManage
          ? "ขณะนี้เปิดใช้งานภาพรวมข้อมูลแล้ว เครื่องมือเพิ่ม แก้ไข และจัดโครงสร้างจะพัฒนาใน Phase 4–6"
          : "บัญชีนี้อ่านข้อมูลผังองค์กรได้ แต่ไม่มีสิทธิ์แก้ไข"}
      </Alert>
      <Grid container spacing={2}>
        {collections.map(({ label, query }) => (
          <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  {label}
                </Typography>
                <Typography variant="h3" sx={{ mt: 1, fontWeight: 700 }}>
                  {query.isPending ? "…" : query.isError ? "—" : query.data.items.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  จำนวนที่โหลด (สูงสุด 100 รายการ)
                </Typography>
                {query.isError && (
                  <Typography role="alert" variant="body2" color="error" sx={{ mt: 1 }}>
                    ไม่สามารถโหลดข้อมูลได้ โปรดลองใหม่อีกครั้ง
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
