import { Box, Button } from "@mui/material";
import Grid from "@mui/material/Grid";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { MediaAsset, PublicContentCardItem } from "../../../types";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import PublicContentCard from "../PublicContentCard";
import { HomeSectionHeading } from "./HomeSectionHeading";

export function ProgramsSection({ items, mediaAssets }: { items: PublicContentCardItem[]; mediaAssets: MediaAsset[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <Box component="section" id="departments" sx={{ mt: { xs: 5, md: 7 } }}>
      <HomeSectionHeading
        label="หลักสูตร"
        title="หลักสูตรและแผนกวิชาที่เปิดสอน"
        description="เลือกเส้นทางการเรียนที่เหมาะกับความสนใจและอาชีพในอนาคต"
        action={
          <Button href={normalizeSafeHref("/departments")} endIcon={<ArrowForwardOutlinedIcon />}>
            ดูหลักสูตรทั้งหมด
          </Button>
        }
      />
      <Grid container spacing={2.5}>
        {items.map((item) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={item.id}>
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
