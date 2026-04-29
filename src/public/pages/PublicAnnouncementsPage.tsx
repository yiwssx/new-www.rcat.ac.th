import { useMemo } from "react";
import { LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

export default function PublicAnnouncementsPage() {
  const { data, isLoading } = usePublicCmsSnapshot();

  const announcementItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter(
          (item) => item.type === "announcement" && item.status === "published"
        )
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );

  const pageItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.type === "page" && item.status === "published")
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );

  return (
    <PublicSiteShell
      title="ประกาศ"
      description="ประกาศราชการ ข้อมูลการรับสมัคร และเอกสารสาธารณะที่เผยแพร่โดยสถานศึกษา"
    >
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
        <CampaignOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          ประกาศราชการ
        </Typography>
      </Stack>
      <Grid container spacing={2.5}>
        {announcementItems.map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={item.id}>
            <PublicContentCard item={item} mediaAssets={data?.media ?? []} icon={<CampaignOutlinedIcon sx={{ fontSize: 42 }} />} />
          </Grid>
        ))}
      </Grid>
      {!announcementItems.length && !isLoading && (
        <EmptyState title="ยังไม่มีประกาศที่เผยแพร่" icon={<CampaignOutlinedIcon />} />
      )}

      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
        <DescriptionOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          หน้าข้อมูลสาธารณะ
        </Typography>
      </Stack>
      <Grid container spacing={2.5}>
        {pageItems.map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={item.id}>
            <PublicContentCard item={item} mediaAssets={data?.media ?? []} icon={<DescriptionOutlinedIcon sx={{ fontSize: 42 }} />} />
          </Grid>
        ))}
      </Grid>
      {!pageItems.length && !isLoading && (
        <EmptyState title="ยังไม่มีเอกสารเผยแพร่" icon={<DescriptionOutlinedIcon />} />
      )}
    </PublicSiteShell>
  );
}
