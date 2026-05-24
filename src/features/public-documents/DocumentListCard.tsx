import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import EmptyState from "../../shared/components/EmptyState";
import { ContentItem } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { HomeSectionHeading } from "../../public/components/home/HomeSectionHeading";
import { PublicDocumentItem } from "./types";

type DocumentListItem = ContentItem | PublicDocumentItem;

function getDocumentHref(item: DocumentListItem) {
  if ("fileUrl" in item && item.fileUrl) {
    return normalizeSafeHref(item.fileUrl);
  }

  if ("slug" in item && item.slug) {
    return normalizeSafeHref(`/content/${item.slug}`);
  }

  return "#";
}

export function DocumentListCard({ items }: { items: DocumentListItem[] }) {
  return (
    <Card id="documents" className="rcat-card h-full">
      <CardContent sx={{ p: 2.5 }}>
        <HomeSectionHeading label="เอกสาร" title="เอกสารเผยแพร่" />
        {items.length ? (
          <Stack spacing={1.1}>
            {items.map((item) => (
              <Box
                key={item.id}
                component="a"
                href={getDocumentHref(item)}
                aria-label={`อ่านเอกสาร ${item.title}`}
                className="rcat-card-muted rcat-focus-ring block p-3"
              >
                <Stack direction="row" spacing={1.2} alignItems="flex-start">
                  <DescriptionOutlinedIcon sx={{ color: "primary.main", mt: 0.2 }} />
                  <Box className="min-w-0 flex-1">
                    <Typography fontWeight={800}>{item.title}</Typography>
                    {item.category && (
                      <Typography color="text.secondary" variant="body2" sx={{ mt: 0.45 }}>
                        {item.category}
                      </Typography>
                    )}
                  </Box>
                  <NavigateNextRoundedIcon sx={{ color: "text.secondary" }} />
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <EmptyState title="ยังไม่มีเอกสารเผยแพร่" icon={<DescriptionOutlinedIcon />} />
        )}
      </CardContent>
    </Card>
  );
}
