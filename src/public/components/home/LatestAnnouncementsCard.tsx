import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import EmptyState from "../../../shared/components/EmptyState";
import FlagEmojiText from "../../../shared/media/FlagEmojiText";
import { PublicContentCardItem } from "../../../types";
import { formatDisplayDate } from "../../../utils/dateDisplay";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

function CompactAnnouncementList({ items, emptyTitle }: { items: PublicContentCardItem[]; emptyTitle: string }) {
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
              <FlagEmojiText>{item.title}</FlagEmojiText>
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

export function LatestAnnouncementsCard({ items }: { items: PublicContentCardItem[] }) {
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
