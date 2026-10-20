import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { MediaAsset, PublicContentCardItem } from "../../../types";
import PublicContentCard from "../PublicContentCard";
import { HomeSectionHeading } from "./HomeSectionHeading";

export function ProgramsSection({ items, mediaAssets }: { items: PublicContentCardItem[]; mediaAssets: MediaAsset[] }) {
  const visibleItems = items.filter((item) => item.status === "published" && item.title.trim() && item.slug.trim());
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <Box component="section" id="departments" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <HomeSectionHeading label="สาขาวิชา" title="สาขาวิชาที่เปิดสอน" />
      <Grid container spacing={2.5}>
        {visibleItems.map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={item.id}>
            <PublicContentCard
              item={item}
              mediaAssets={mediaAssets}
              icon={<SchoolOutlinedIcon sx={{ fontSize: 42 }} />}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
