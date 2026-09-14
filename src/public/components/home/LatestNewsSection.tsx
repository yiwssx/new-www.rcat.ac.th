import { Button } from "@mui/material";
import Grid from "@mui/material/Grid";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { MediaAsset, PublicContentCardItem } from "../../../types";
import EmptyState from "../../../shared/components/EmptyState";
import PublicContentCard from "../PublicContentCard";
import { HomeSectionHeading } from "./HomeSectionHeading";

export function LatestNewsSection({
  items,
  mediaAssets
}: {
  items: PublicContentCardItem[];
  mediaAssets: MediaAsset[];
}) {
  return (
    <>
      <HomeSectionHeading
        label="ข่าวเด่น"
        title="เรื่องราวและกิจกรรมล่าสุดจาก RCAT"
        description="ติดตามกิจกรรม ผลงาน และข่าวประชาสัมพันธ์ล่าสุดของวิทยาลัย"
        action={
          <Button href={normalizeSafeHref("/news")} endIcon={<ArrowForwardOutlinedIcon />}>
            ดูข่าวทั้งหมด
          </Button>
        }
      />
      {items.length ? (
        <Grid container spacing={2.5}>
          {items.map((item, index) => (
            <Grid size={{ xs: 12, md: index === 0 ? 12 : 6 }} key={item.id}>
              <PublicContentCard
                item={item}
                mediaAssets={mediaAssets}
                icon={<CampaignOutlinedIcon sx={{ fontSize: 42 }} />}
                presentation="home-news"
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <EmptyState title="ยังไม่มีข่าวที่เผยแพร่" icon={<ArticleOutlinedIcon />} />
      )}
    </>
  );
}
