import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import EmptyState from "../../../shared/components/EmptyState";
import { ContentItem } from "../../../types";
import { formatDisplayDate } from "../../../utils/dateDisplay";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";
import { focusVisibleSx } from "./homeSectionStyles";

function CompactAnnouncementList({ items, emptyTitle }: { items: ContentItem[]; emptyTitle: string }) {
  if (!items.length) {
    return <EmptyState title={emptyTitle} icon={<CampaignOutlinedIcon />} />;
  }

  return (
    <Stack divider={<Divider flexItem />} spacing={0}>
      {items.map((item) => (
        <Box
          key={item.id}
          component="a"
          href={normalizeSafeHref(`/content/${item.slug}`)}
          aria-label={`อ่านประกาศ ${item.title}`}
          sx={{
            display: "block",
            py: 1.45,
            px: 0.5,
            borderRadius: 1.5,
            ...focusVisibleSx
          }}
        >
          <Stack spacing={0.8}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip label="ประกาศ" size="small" color={item.featured ? "secondary" : "default"} />
              {item.category && <Chip label={item.category} size="small" variant="outlined" />}
            </Stack>
            <Typography fontWeight={900}>{item.title}</Typography>
            <Typography color="text.secondary" variant="body2">
              {formatDisplayDate(item.publishAt)}
            </Typography>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

export function LatestAnnouncementsCard({ items }: { items: ContentItem[] }) {
  return (
    <Card id="announcements" sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <HomeSectionHeading
          label="ประกาศ"
          title="ประกาศล่าสุด"
          action={
            <Button href={normalizeSafeHref("/announcements")} endIcon={<ArrowForwardOutlinedIcon />}>
              ทั้งหมด
            </Button>
          }
        />
        <CompactAnnouncementList items={items} emptyTitle="ยังไม่มีประกาศที่เผยแพร่" />
      </CardContent>
    </Card>
  );
}
