import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicOrganizationPosition } from "../../features/public-organization";
import { publicOrganizationDetailQueryOptions } from "../../features/public-organization";
import PublicResponsiveImage from "../../shared/media/PublicResponsiveImage";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState from "../components/PublicLoadingState";

interface Props {
  slug: string;
}

function PositionGroup({ position, media }: { position: PublicOrganizationPosition; media: Map<string, import("../../types").MediaAsset> }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="h3" sx={{ fontSize: "1.1rem", fontWeight: 700, overflowWrap: "anywhere" }}>
              {position.title}
            </Typography>
            {position.groupLabel && (
              <Typography variant="body2" color="text.secondary">
                {position.groupLabel}
              </Typography>
            )}
          </Box>
          {position.assignments.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              ยังไม่ได้ระบุผู้ดำรงตำแหน่ง
            </Typography>
          ) : (
            <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", p: 0, m: 0 }}>
              {position.assignments.map((assignment) => {
                const person = assignment.person;
                const portrait = person.photoMediaId ? media.get(person.photoMediaId) : undefined;
                return (
                  <Stack
                    component="li"
                    key={assignment.id}
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{ minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        flexShrink: 0,
                        width: { xs: 60, sm: 72 },
                        height: { xs: 60, sm: 72 },
                        borderRadius: 1.5,
                        overflow: "hidden",
                        bgcolor: "action.hover",
                        display: "grid",
                        placeItems: "center"
                      }}
                    >
                      {portrait?.type === "image" ? (
                        <PublicResponsiveImage
                          intent="content-body"
                          source={portrait}
                          alt={`ภาพของ${person.displayName}`}
                          width={72}
                          height={72}
                          aspectRatio="1 / 1"
                        />
                      ) : (
                        <BadgeOutlinedIcon color="disabled" sx={{ fontSize: 30 }} aria-hidden="true" />
                      )}
                    </Box>
                    <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                        {person.displayName}
                      </Typography>
                      {assignment.dutyDetail && (
                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                          {assignment.dutyDetail}
                        </Typography>
                      )}
                      {person.employmentPosition && (
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                          {person.employmentPosition}
                        </Typography>
                      )}
                      {person.publicEmail && (
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                          อีเมล: {person.publicEmail}
                        </Typography>
                      )}
                      {person.publicPhone && (
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                          โทรศัพท์: {person.publicPhone}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function PublicOrganizationDetailPage({ slug }: Props) {
  const query = useQuery(publicOrganizationDetailQueryOptions(slug, { consumeAbortSignal: false }));
  const data = query.data;
  const byUnit = useMemo(() => {
    const map = new Map<string, PublicOrganizationPosition[]>();
    for (const position of data?.positions ?? []) {
      const current = map.get(position.unitContentId) ?? [];
      current.push(position);
      map.set(position.unitContentId, current);
    }
    return map;
  }, [data?.positions]);
  const media = useMemo(() => new Map((data?.media ?? []).map((asset) => [asset.id, asset])), [data?.media]);

  if (query.isPending) return <PublicLoadingState variant="listing" />;
  if (query.isError) {
    return <PublicErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />;
  }
  if (!data) {
    return (
      <Stack spacing={2} sx={{ py: 6 }}>
        <Typography variant="h1">ไม่พบหน่วยงาน</Typography>
        <Typography>ข้อมูลนี้อาจยังไม่ได้เผยแพร่หรือไม่สามารถเข้าถึงได้</Typography>
        <Link href="/">กลับหน้าหลัก</Link>
      </Stack>
    );
  }

  return (
    <Box component="article" sx={{ width: "100%", minWidth: 0, pb: 5 }}>
      <Breadcrumbs aria-label="ลำดับหน่วยงาน" sx={{ mb: 3 }}>
        <Link href="/" underline="hover" color="inherit">
          หน้าหลัก
        </Link>
        {data.ancestors.map((ancestor) => (
          <Link
            key={ancestor.contentId}
            href={`/organization/${encodeURIComponent(ancestor.slug)}`}
            underline="hover"
            color="inherit"
          >
            {ancestor.title}
          </Link>
        ))}
        <Typography color="text.primary">{data.unit.title}</Typography>
      </Breadcrumbs>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 3 }}>
        <AccountTreeOutlinedIcon color="primary" sx={{ fontSize: 36, flexShrink: 0 }} aria-hidden="true" />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1" sx={{ fontSize: { xs: "1.7rem", md: "2.25rem" }, fontWeight: 700, overflowWrap: "anywhere" }}>
            {data.unit.title}
          </Typography>
          {data.unit.summary && (
            <Typography color="text.secondary" sx={{ mt: 1, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
              {data.unit.summary}
            </Typography>
          )}
        </Box>
      </Stack>
      <Stack spacing={3}>
        {data.units.map((unit) => {
          const positions = byUnit.get(unit.contentId) ?? [];
          const isRoot = unit.contentId === data.unit.contentId;
          return (
            <Box
              component="section"
              key={unit.contentId}
              aria-labelledby={`org-unit-${unit.contentId}`}
              sx={{
                pl: isRoot ? 0 : { xs: 1, sm: Math.min(unit.depth - data.unit.depth, 5) * 2 },
                borderLeft: isRoot ? "none" : "3px solid",
                borderColor: "divider",
                minWidth: 0
              }}
            >
              {!isRoot && (
                <Typography
                  id={`org-unit-${unit.contentId}`}
                  variant="h2"
                  sx={{ mb: 1.5, fontSize: "1.35rem", overflowWrap: "anywhere" }}
                >
                  <Link href={`/organization/${encodeURIComponent(unit.slug)}`} underline="hover" color="inherit">
                    {unit.title}
                  </Link>
                </Typography>
              )}
              {positions.length > 0 && (
                <Grid container spacing={2} aria-label={`ตำแหน่งของ${unit.title}`}>
                  {positions.map((position) => (
                    <Grid key={position.id} size={{ xs: 12, md: 6, xl: 4 }}>
                      <PositionGroup position={position} media={media} />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
