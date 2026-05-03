import { useMemo } from "react";
import { Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";
import { normalizeSafeHref } from "../../utils/safeUrl";

function readSearchParam(name: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get(name)?.trim() || "";
}

function normalizeCategoryList(category: string | undefined) {
  return String(category || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PublicNewsPage() {
  const { data, isLoading } = usePublicCmsSnapshot();
  const activeTag = readSearchParam("tag");
  const activeCategory = readSearchParam("category");
  const hasActiveFilter = Boolean(activeTag || activeCategory);

  const newsItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.type === "news" && item.status === "published")
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );
  const filteredNewsItems = useMemo(
    () =>
      newsItems.filter((item) => {
        const matchesTag = activeTag ? (item.tags ?? []).includes(activeTag) : true;
        const matchesCategory = activeCategory ? normalizeCategoryList(item.category).includes(activeCategory) : true;
        return matchesTag && matchesCategory;
      }),
    [activeCategory, activeTag, newsItems]
  );

  const [featuredItem, ...secondaryItems] = filteredNewsItems;

  return (
    <PublicSiteShell
      title="ข่าว"
      description="กิจกรรมล่าสุด เรื่องราวในสถานศึกษา และข่าวประชาสัมพันธ์จาก CMS"
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
          ข่าวทั้งหมด
        </Typography>
      </Stack>
      {hasActiveFilter && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 2 }}>
          {activeTag && <Chip label={`#${activeTag}`} color="secondary" />}
          {activeCategory && <Chip label={activeCategory} color="secondary" variant="outlined" />}
          <Button href={normalizeSafeHref("/news")} size="small">
            ล้างตัวกรอง
          </Button>
        </Stack>
      )}
      <Grid container spacing={2.5}>
        {secondaryItems.map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={item.id}>
            <PublicContentCard item={item} mediaAssets={data?.media ?? []} />
          </Grid>
        ))}
      </Grid>
      {!filteredNewsItems.length && !isLoading && (
        <EmptyState
          title={hasActiveFilter ? "ไม่พบข่าวตามตัวกรองที่เลือก" : "ยังไม่มีข่าวที่เผยแพร่"}
          icon={<ArticleOutlinedIcon />}
        />
      )}
    </PublicSiteShell>
  );
}
