import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import EmptyState from "../../../shared/components/EmptyState";
import { ContentItem } from "../../../types";
import { formatDisplayDate } from "../../../utils/dateDisplay";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

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
          className="rcat-focus-ring block rounded-md px-1 py-3"
        >
          <Stack spacing={0.8}>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{
                alignItems: "center",
                flexWrap: "wrap"
              }}
            >
              <Chip label="ประกาศ" size="small" color={item.featured ? "secondary" : "default"} />
              {item.category && <Chip label={item.category} size="small" variant="outlined" />}
            </Stack>
            <Typography
              sx={{
                fontWeight: 900
              }}
            >
              {item.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary"
              }}
            >
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
    <Card id="announcements" className="rcat-card h-full">
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
