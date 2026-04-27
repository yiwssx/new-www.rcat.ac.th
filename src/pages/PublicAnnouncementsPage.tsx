import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid, LinearProgress, Stack, Typography } from "@mui/material";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { getCmsSnapshot } from "../services/googleApi";

export default function PublicAnnouncementsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
  });

  const announcementItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter(
          (item) => item.type === "announcement" && (item.status === "published" || item.status === "scheduled")
        )
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );

  const pageItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.type === "page" && (item.status === "published" || item.status === "scheduled"))
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );

  return (
    <PublicSiteShell
      title="Announcements"
      description="Official notices, admissions information, and public documents published by the college."
    >
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
        <CampaignOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          Official Notices
        </Typography>
      </Stack>
      <Grid container spacing={2.5}>
        {announcementItems.map((item) => (
          <Grid item xs={12} md={6} key={item.id}>
            <PublicContentCard item={item} mediaAssets={data?.media ?? []} icon={<CampaignOutlinedIcon sx={{ fontSize: 42 }} />} />
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
        <DescriptionOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          Public Pages
        </Typography>
      </Stack>
      <Grid container spacing={2.5}>
        {pageItems.map((item) => (
          <Grid item xs={12} md={6} key={item.id}>
            <PublicContentCard item={item} mediaAssets={data?.media ?? []} icon={<DescriptionOutlinedIcon sx={{ fontSize: 42 }} />} />
          </Grid>
        ))}
      </Grid>
    </PublicSiteShell>
  );
}
