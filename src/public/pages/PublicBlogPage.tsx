import { useMemo } from "react";
import { LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

export default function PublicBlogPage() {
  const { data, isFetching } = usePublicCmsSnapshot();

  const blogItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.type === "blog" && item.status === "published")
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );

  const [featuredItem, ...secondaryItems] = blogItems;

  if (!data) {
    return <PublicSiteShell>{null}</PublicSiteShell>;
  }

  return (
    <PublicSiteShell title="บทความ" description="บทความและเนื้อหาระยะยาวที่เผยแพร่จาก CMS">
      {isFetching && <LinearProgress sx={{ mb: 3 }} />}
      {featuredItem && (
        <PublicContentCard
          item={featuredItem}
          mediaAssets={data?.media ?? []}
          icon={<AutoStoriesOutlinedIcon sx={{ fontSize: 58 }} />}
          featured
        />
      )}
      {!blogItems.length && (
        <EmptyState title="ยังไม่มีบทความที่เผยแพร่" icon={<EditNoteOutlinedIcon />} />
      )}
      {!!secondaryItems.length && (
        <>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
            <EditNoteOutlinedIcon color="primary" />
            <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
              บทความล่าสุด
            </Typography>
          </Stack>
          <Grid container spacing={2.5}>
            {secondaryItems.map((item) => (
              <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                <PublicContentCard
                  item={item}
                  mediaAssets={data?.media ?? []}
                  icon={<EditNoteOutlinedIcon sx={{ fontSize: 42 }} />}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </PublicSiteShell>
  );
}
