import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid, LinearProgress, Stack, Typography } from "@mui/material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { getCmsSnapshot } from "../services/googleApi";

export default function PublicNewsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
  });

  const newsItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.type === "news" && (item.status === "published" || item.status === "scheduled"))
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );

  const [featuredItem, ...secondaryItems] = newsItems;

  return (
    <PublicSiteShell
      title="News"
      description="Latest college activities, campus stories, and public updates from the CMS."
    >
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      {featuredItem && (
        <PublicContentCard
          item={featuredItem}
          mediaAssets={data?.media ?? []}
          icon={<CampaignOutlinedIcon sx={{ fontSize: 58 }} />}
          featured
        />
      )}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
        <ArticleOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          All News
        </Typography>
      </Stack>
      <Grid container spacing={2.5}>
        {secondaryItems.map((item) => (
          <Grid item xs={12} md={6} key={item.id}>
            <PublicContentCard item={item} mediaAssets={data?.media ?? []} />
          </Grid>
        ))}
      </Grid>
    </PublicSiteShell>
  );
}
