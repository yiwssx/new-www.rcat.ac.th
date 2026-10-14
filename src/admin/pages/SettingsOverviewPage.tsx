import { Link } from "@tanstack/react-router";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import PageHeader from "../components/PageHeader";
import { settingsNavigation } from "./settings/settingsSections";

export default function SettingsOverviewPage() {
  return (
    <Box>
      <PageHeader
        title="ตั้งค่าระบบ"
        description="เลือกหัวข้อที่ต้องการจัดการ แต่ละหมวดมีหน้าและที่อยู่ URL แยกจากกัน"
      />
      <Grid container spacing={2}>
        {settingsNavigation.map((item) => (
          <Grid key={item.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea component={Link} to={`/admin/settings/${item.id}`} sx={{ height: "100%" }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="h3" sx={{ mb: 1 }}>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
