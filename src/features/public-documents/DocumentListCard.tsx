import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import NavigateNextOutlinedIcon from "@mui/icons-material/NavigateNextOutlined";
import EmptyState from "../../shared/components/EmptyState";
import type { ContentItem } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { HomeSectionHeading } from "../../public/components/home/HomeSectionHeading";
import type { PublicDocumentItem } from "./types";

type DocumentListItem = ContentItem | PublicDocumentItem;

interface DocumentListCardProps {
  items: DocumentListItem[];
  limit?: number;
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyTitle?: string;
}

function getDocumentHref(item: DocumentListItem) {
  if ("fileUrl" in item && item.fileUrl) {
    return normalizeSafeHref(item.fileUrl);
  }

  if ("slug" in item && item.slug) {
    return normalizeSafeHref(`/content/${item.slug}`);
  }

  return "#";
}

function getVisibleItems(items: DocumentListItem[], limit: number | undefined) {
  if (limit === undefined) {
    return items;
  }

  return items.slice(0, Math.max(0, Math.floor(limit)));
}

export function DocumentListCard({
  items,
  limit,
  viewAllHref,
  viewAllLabel = "ดูทั้งหมด",
  emptyTitle = "ยังไม่มีเอกสารเผยแพร่"
}: DocumentListCardProps) {
  const visibleItems = getVisibleItems(items, limit);

  return (
    <Card id="documents" className="rcat-card h-full">
      <CardContent sx={{ p: 2.5 }}>
        <HomeSectionHeading label="เอกสาร" title="เอกสารเผยแพร่" />
        {visibleItems.length ? (
          <Stack spacing={1.1}>
            {visibleItems.map((item) => (
              <Box
                key={item.id}
                component="a"
                href={getDocumentHref(item)}
                aria-label={`อ่านเอกสาร ${item.title}`}
                className="rcat-card-muted rcat-focus-ring block p-3"
              >
                <Stack
                  direction="row"
                  spacing={1.2}
                  sx={{
                    alignItems: "flex-start"
                  }}
                >
                  <DescriptionOutlinedIcon sx={{ color: "primary.main", mt: 0.2 }} />
                  <Box className="min-w-0 flex-1">
                    <Typography
                      sx={{
                        fontWeight: 800
                      }}
                    >
                      {item.title}
                    </Typography>
                    {item.category && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          mt: 0.45
                        }}
                      >
                        {item.category}
                      </Typography>
                    )}
                  </Box>
                  <NavigateNextOutlinedIcon sx={{ color: "text.secondary" }} />
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <EmptyState title={emptyTitle} icon={<DescriptionOutlinedIcon />} />
        )}
        {viewAllHref && (
          <Button
            href={normalizeSafeHref(viewAllHref)}
            aria-label="ดูเอกสารเผยแพร่ทั้งหมด"
            endIcon={<ArrowForwardOutlinedIcon />}
            sx={{ mt: 1.6 }}
            fullWidth
          >
            {viewAllLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
