import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Grid, LinearProgress, Stack, Typography } from "@mui/material";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { getCmsSnapshot } from "../services/googleApi";

export default function PublicBlogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
  });

  const blogItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.type === "blog" && (item.status === "published" || item.status === "scheduled"))
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );

  const [featuredItem, ...secondaryItems] = blogItems;

  return (
    <PublicSiteShell
      title="Blog"
      description="Editorial stories, updates, and long-form campus content published from the CMS."
    >
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      {featuredItem && (
        <PublicContentCard
          item={featuredItem}
          mediaAssets={data?.media ?? []}
          icon={<AutoStoriesOutlinedIcon sx={{ fontSize: 58 }} />}
          featured
        />
      )}
      {!blogItems.length && !isLoading && (
        <Box sx={{ py: 6 }}>
          <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="center">
            <EditNoteOutlinedIcon color="primary" />
            <Typography color="text.secondary">No published blog posts yet.</Typography>
          </Stack>
        </Box>
      )}
      {!!secondaryItems.length && (
        <>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
            <EditNoteOutlinedIcon color="primary" />
            <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
              Latest Posts
            </Typography>
          </Stack>
          <Grid container spacing={2.5}>
            {secondaryItems.map((item) => (
              <Grid item xs={12} md={6} key={item.id}>
                <PublicContentCard item={item} mediaAssets={data?.media ?? []} icon={<EditNoteOutlinedIcon sx={{ fontSize: 42 }} />} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </PublicSiteShell>
  );
}
