import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import EmptyState from "../../../shared/components/EmptyState";
import { ContentItem } from "../../../types";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";
import { focusVisibleSx } from "./homeSectionStyles";

export function DocumentListCard({ items }: { items: ContentItem[] }) {
  return (
    <Card id="documents" sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <HomeSectionHeading label="เอกสาร" title="เอกสารเผยแพร่" />
        {items.length ? (
          <Stack spacing={1.1}>
            {items.map((item) => (
              <Box
                key={item.id}
                component="a"
                href={normalizeSafeHref(`/content/${item.slug}`)}
                aria-label={`อ่านเอกสาร ${item.title}`}
                sx={{
                  p: 1.5,
                  display: "block",
                  borderRadius: 2,
                  bgcolor: "background.default",
                  border: "1px solid rgba(31, 90, 44, 0.12)",
                  ...focusVisibleSx
                }}
              >
                <Stack direction="row" spacing={1.2} alignItems="flex-start">
                  <DescriptionOutlinedIcon sx={{ color: "primary.main", mt: 0.2 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
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
