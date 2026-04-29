import { useMemo } from "react";
import { LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

export default function PublicDepartmentsPage() {
  const { data, isLoading } = usePublicCmsSnapshot();

  const programItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.type === "program" && item.status === "published")
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );

  return (
    <PublicSiteShell
      title="หลักสูตร"
      description="ข้อมูลหลักสูตรที่เผยแพร่จาก CMS"
    >
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
        <SchoolOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          ข้อมูลหลักสูตรที่เผยแพร่
        </Typography>
      </Stack>
      {programItems.length ? (
        <Grid container spacing={2.5}>
          {programItems.map((item) => (
            <Grid size={{ xs: 12, md: 6 }} key={item.id}>
              <PublicContentCard item={item} mediaAssets={data?.media ?? []} icon={<SchoolOutlinedIcon sx={{ fontSize: 42 }} />} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <EmptyState title="ยังไม่มีข้อมูลหลักสูตรที่เผยแพร่" icon={<SchoolOutlinedIcon />} />
      )}
    </PublicSiteShell>
  );
}
