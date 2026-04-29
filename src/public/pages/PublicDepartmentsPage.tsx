import {
  useMemo } from "react";
import { Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

const departments = [
  {
    title: "เทคโนโลยีวิศวกรรม",
    description:
      "ระบบอัตโนมัติ หุ่นยนต์ อิเล็กทรอนิกส์ การพัฒนาต้นแบบ และการปฏิบัติงานวิศวกรรมประยุกต์",
    icon: <EngineeringOutlinedIcon sx={{ fontSize: 42 }} />,
    tags: ["หุ่นยนต์", "ระบบอัตโนมัติ", "อิเล็กทรอนิกส์"]
  },
  {
    title: "ธุรกิจดิจิทัล",
    description:
      "การตลาด ผู้ประกอบการ การวิเคราะห์ข้อมูล เครื่องมือดิจิทัล และระบบธุรกิจใช้งานจริง",
    icon: <AutoStoriesOutlinedIcon sx={{ fontSize: 42 }} />,
    tags: ["การตลาด", "วิเคราะห์ข้อมูล", "ธุรกิจ"]
  },
  {
    title: "พัฒนาผู้เรียน",
    description:
      "แนะแนว กิจกรรม แฟ้มสะสมผลงาน การดูแลผู้เรียน และความพร้อมสู่อาชีพ",
    icon: <GroupsOutlinedIcon sx={{ fontSize: 42 }} />,
    tags: ["แนะแนว", "กิจกรรม", "อาชีพ"]
  }
];

export default function PublicDepartmentsPage() {
  const { data, isLoading } = usePublicCmsSnapshot();

  const programItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.type === "program" && (item.status === "published" || item.status === "scheduled"))
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );

  return (
    <PublicSiteShell
      title="แผนกวิชา"
      description="แผนกวิชา เส้นทางการเรียนรู้ และข้อมูลหลักสูตรที่เผยแพร่จาก CMS"
    >
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      <Grid container spacing={2.5}>
        {departments.map((department) => (
          <Grid size={{ xs: 12, md: 4 }} key={department.title}>
            <Card sx={{ height: "100%" }}>
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    width: 68,
                    height: 68,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "primary.light",
                    color: "primary.main",
                    mb: 2
                  }}
                >
                  {department.icon}
                </Box>
                <Typography variant="h3">{department.title}</Typography>
                <Typography color="text.secondary" sx={{ mt: 1.2 }}>
                  {department.description}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                  {department.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
          <SchoolOutlinedIcon color="primary" />
          <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
            ข้อมูลหลักสูตร
          </Typography>
        </Stack>
        <Grid container spacing={2.5}>
          {programItems.map((item) => (
            <Grid size={{ xs: 12, md: 6 }} key={item.id}>
              <PublicContentCard item={item} mediaAssets={data?.media ?? []} icon={<SchoolOutlinedIcon sx={{ fontSize: 42 }} />} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </PublicSiteShell>
  );
}
