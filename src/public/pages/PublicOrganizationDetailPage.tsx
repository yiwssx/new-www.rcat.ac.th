import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicOrganizationPosition } from "../../features/public-organization";
import { publicOrganizationDetailQueryOptions } from "../../features/public-organization";
import { buildPublicOrganizationHierarchy } from "../../features/public-organization/hierarchy";
import OrganizationUnitHierarchyView from "../components/OrganizationUnitHierarchyView";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState from "../components/PublicLoadingState";

interface Props {
  slug: string;
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
  const hierarchy = useMemo(
    () => buildPublicOrganizationHierarchy(data?.units ?? [], data?.unit.contentId ?? ""),
    [data?.units, data?.unit.contentId]
  );

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
      <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: "flex-start" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h1"
            sx={{ fontSize: { xs: "1.7rem", md: "2.25rem" }, fontWeight: 700, overflowWrap: "anywhere" }}
          >
            {data.unit.title}
          </Typography>
          {data.unit.summary && (
            <Typography color="text.secondary" sx={{ mt: 1, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
              {data.unit.summary}
            </Typography>
          )}
        </Box>
      </Stack>
      <OrganizationUnitHierarchyView hierarchy={hierarchy} positionsByUnit={byUnit} media={media} />
    </Box>
  );
}
