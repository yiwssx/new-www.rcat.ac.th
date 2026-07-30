import { Box } from "@mui/material";
import Grid from "@mui/material/Grid";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { ContentItem, MediaAsset } from "../../../types";
import EmptyState from "../../../shared/components/EmptyState";
import PublicContentCard from "../PublicContentCard";
import { HomeSectionHeading } from "./HomeSectionHeading";

export function ProgramsSection({ items, mediaAssets }: { items: ContentItem[]; mediaAssets: MediaAsset[] }) {
  return (
    <Box component="section" id="departments" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <HomeSectionHeading label="หลักสูตร" title="หลักสูตรที่เปิดสอน" />
      {items.length ? (
        <Grid container spacing={2.5}>
          {items.map((item) => (
            <Grid size={{ xs: 12, md: 6 }} key={item.id}>
              <PublicContentCard
                item={item}
                mediaAssets={mediaAssets}
                icon={<SchoolOutlinedIcon sx={{ fontSize: 42 }} />}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <EmptyState title="ยังไม่มีข้อมูลหลักสูตรที่เผยแพร่" icon={<SchoolOutlinedIcon />} />
      )}
    </Box>
  );
}
